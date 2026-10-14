"""
Único punto de llamada a Groq.

Antes de cada llamada verifica el cupo del profesional y el margen de la cuenta.
Ante 429 o error transitorio reintenta con espera creciente respetando retry-after;
si no se puede, levanta IAPendiente ("Procesando, puede demorar"), nunca un error crudo.

Cada intento queda en ai_usage_log SIN contenido: ni audio, ni texto, ni datos del paciente.
Los logs tampoco llevan contenido: solo uid, tipo, modelo, cantidades y códigos.
"""
import logging
import os
import threading
import time
from datetime import datetime
from typing import Callable

import groq as groq_module
from groq import Groq

from ai_config import get_ai_config
from services.ai_errors import CupoAgotado, IAError, IAPendiente, TextoDemasiadoLargo
from services.ai_usage_service import (
    AccountTracker, FirestoreUsageStore, UsageStore, get_quota_status, record_usage,
)

log = logging.getLogger("secretaria.ia")

MIN_BILLED_AUDIO_S = 10          # Groq cobra mínimo 10 s por pedido de audio
_EST_AUDIO_BYTES_PER_S = 4000    # ~32 kbps (Opus/WebM); solo para estimar antes de llamar
_WHISPER_TIMEOUT_S = 20.0
_LLM_TIMEOUT_S = 60.0
_CHARS_PER_TOKEN = 4             # estimación para español

_client: Groq | None = None
_store: UsageStore | None = None
_tracker: AccountTracker | None = None
_sleep: Callable[[float], None] = time.sleep


def _get_client() -> Groq:
    global _client
    if _client is None:
        # max_retries=0: los reintentos los maneja este módulo
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"), max_retries=0)
    return _client


def get_store() -> UsageStore:
    global _store
    if _store is None:
        from services.firebase_service import get_firestore
        _store = FirestoreUsageStore(get_firestore())
    return _store


def get_tracker() -> AccountTracker:
    global _tracker
    if _tracker is None:
        _tracker = AccountTracker(get_store())
    return _tracker


# ── Alertas ───────────────────────────────────────────────────────────────────

def _alert(key: str, asunto: str, texto: str) -> None:
    """Log warning + mail a AI_ALERT_EMAIL, una sola vez por clave."""
    try:
        if not get_store().claim_alert(key):
            return
    except Exception:
        log.exception("[IA] no se pudo registrar la alerta %s", key)
        return
    log.warning("[IA][ALERTA] %s", texto)
    to = get_ai_config().alert_email
    if to:
        from services.email_service import _send
        html = f'<div style="font-family:sans-serif"><h3>{asunto}</h3><p>{texto}</p></div>'
        threading.Thread(target=_send, args=(to, f"SecretarIA: {asunto}", html), daemon=True).start()


def _check_alerts(uid: str) -> None:
    cfg = get_ai_config()
    try:
        status = get_quota_status(get_store(), uid, cfg=cfg)
        if not status.ilimitado and not status.sin_ia:
            now = datetime.now(cfg.tz)
            for usado, limite, nombre, bucket in (
                (status.usado_dia_min, status.limite_dia_min, "diario", f"d_{now:%Y-%m-%d}"),
                (status.usado_mes_min, status.limite_mes_min, "mensual", f"m_{now:%Y-%m}"),
            ):
                if limite and usado / limite * 100 >= cfg.quota_warn_pct:
                    _alert(f"prof_{uid}_{bucket}", "cupo de profesional",
                           f"El profesional {uid} usó {int(usado / limite * 100)} % de su cupo {nombre} "
                           f"({int(usado)} de {limite} min).")

        for item in get_tracker().usage(cfg):
            if item["porcentaje"] >= 80:
                bucket = time.strftime("%Y%m%d%H" if item["ventana"] != "dia" else "%Y%m%d", time.gmtime())
                _alert(f"cuenta_{item['ventana']}_{item['campo']}_{bucket}", "límite de la cuenta Groq",
                       f"La cuenta Groq está al {item['porcentaje']} % de «{item['limite']}» "
                       f"({item['usado']} de {item['maximo']}).")
    except Exception:
        log.exception("[IA] error revisando alertas")


# ── Llamada con control ───────────────────────────────────────────────────────

def _retry_after(exc: Exception) -> float | None:
    response = getattr(exc, "response", None)
    value = response.headers.get("retry-after") if response is not None else None
    try:
        return float(value) if value is not None else None
    except ValueError:
        return None


def _controlled_call(uid: str, tipo: str, kind: str, model: str, call: Callable,
                     measure: Callable, est_audio_s: float = 0, est_tokens: int = 0):
    """Ejecuta `call` (que devuelve la respuesta cruda de Groq) con cupo, margen y reintentos.
    `measure(parsed)` devuelve (resultado, segundos_audio, tokens_entrada, tokens_salida)."""
    cfg = get_ai_config()
    store = get_store()
    tracker = get_tracker()
    base = {"profesional_id": uid, "tipo": tipo, "modelo": model}

    status = get_quota_status(store, uid, cfg=cfg)
    if status.sin_ia or (kind == "whisper" and status.bloqueado):
        record_usage(store, {**base, "resultado": "rechazado_cupo"}, cfg=cfg)
        log.info("[IA] rechazado por cupo uid=%s tipo=%s", uid, tipo)
        raise CupoAgotado(status.mensaje, status.renueva)

    if kind == "llm" and est_tokens > cfg.llm_tpm:
        record_usage(store, {**base, "resultado": "error", "codigo_error": "demasiado_largo"}, cfg=cfg)
        log.info("[IA] pedido demasiado largo uid=%s tipo=%s tokens_est=%d", uid, tipo, est_tokens)
        raise TextoDemasiadoLargo()

    for attempt in range(1, cfg.retry_max_attempts + 1):
        backoff = cfg.retry_base_seconds * 2 ** (attempt - 1)
        last = attempt == cfg.retry_max_attempts

        # Margen de la cuenta: si falta, esperar acá (sin llamar a Groq) o dejar pendiente
        try:
            tracker.check(cfg, kind, model, est_audio_s, est_tokens)
        except IAPendiente as p:
            if last or p.retry_after > cfg.retry_max_wait_seconds:
                log.info("[IA] cuenta sin margen uid=%s tipo=%s espera=%ss", uid, tipo, p.retry_after)
                raise
            _sleep(p.retry_after)
            continue

        t0 = time.monotonic()
        try:
            raw = call()
        except groq_module.RateLimitError as e:
            codigo, wait = "429", max(_retry_after(e) or 0, backoff)
        except groq_module.APIStatusError as e:
            if e.status_code == 413:
                record_usage(store, {**base, "resultado": "error", "codigo_error": "413",
                                     "intento": attempt, "duracion_ms": _ms(t0)}, cfg=cfg)
                raise TextoDemasiadoLargo()
            if e.status_code < 500:
                record_usage(store, {**base, "resultado": "error", "codigo_error": str(e.status_code),
                                     "intento": attempt, "duracion_ms": _ms(t0)}, cfg=cfg)
                log.error("[IA] Groq %s uid=%s tipo=%s", e.status_code, uid, tipo)
                raise IAError()
            codigo, wait = str(e.status_code), max(_retry_after(e) or 0, backoff)
        except groq_module.APITimeoutError:
            codigo, wait = "timeout", backoff
        except groq_module.APIConnectionError:
            codigo, wait = "conexion", backoff
        else:
            tracker.update_headers(model, raw.headers)
            result, audio_s, tok_in, tok_out = measure(raw.parse())
            record_usage(store, {**base, "resultado": "ok", "segundos_audio": audio_s,
                                 "tokens_entrada": tok_in, "tokens_salida": tok_out,
                                 "intento": attempt, "duracion_ms": _ms(t0)}, cfg=cfg)
            tracker.record(kind, audio_s=audio_s, tokens=tok_in + tok_out)
            _check_alerts(uid)
            return result

        entry = {**base, "codigo_error": codigo, "intento": attempt, "duracion_ms": _ms(t0)}
        if not last and wait <= cfg.retry_max_wait_seconds:
            record_usage(store, {**entry, "resultado": "reintento"}, cfg=cfg)
            log.info("[IA] %s uid=%s tipo=%s intento=%d, reintento en %.1fs", codigo, uid, tipo, attempt, wait)
            _sleep(wait)
            continue
        record_usage(store, {**entry, "resultado": "error"}, cfg=cfg)
        log.warning("[IA] %s uid=%s tipo=%s: queda pendiente (%.0fs)", codigo, uid, tipo, wait)
        raise IAPendiente(wait)

    raise IAPendiente(cfg.retry_max_wait_seconds)


def _ms(t0: float) -> int:
    return int((time.monotonic() - t0) * 1000)


# ── API pública ───────────────────────────────────────────────────────────────

def transcribe(uid: str, tipo: str, audio: bytes, filename: str) -> str:
    """Transcribe audio con Whisper. Descuenta del cupo los segundos que cobra Groq."""
    cfg = get_ai_config()
    est = max(MIN_BILLED_AUDIO_S, len(audio) / _EST_AUDIO_BYTES_PER_S)

    def call():
        return _get_client().audio.transcriptions.with_raw_response.create(
            file=(filename, audio, "audio/webm"),
            model=cfg.whisper_model,
            language="es",
            response_format="verbose_json",
            timeout=_WHISPER_TIMEOUT_S,
        )

    def measure(parsed):
        duration = getattr(parsed, "duration", None)
        if duration is None:
            segments = getattr(parsed, "segments", None) or []
            last = segments[-1] if segments else None
            duration = (last.get("end") if isinstance(last, dict) else getattr(last, "end", None)) or est
        billed = max(MIN_BILLED_AUDIO_S, float(duration))
        return (parsed.text or "").strip(), round(billed, 1), 0, 0

    return _controlled_call(uid, tipo, "whisper", cfg.whisper_model, call, measure, est_audio_s=est)


def chat(uid: str, tipo: str, model: str, prompt: str, temperature: float, max_tokens: int) -> str:
    """Una completion de un solo mensaje de usuario. Devuelve el texto de la respuesta."""
    est_tokens = len(prompt) // _CHARS_PER_TOKEN + max_tokens

    def call():
        return _get_client().chat.completions.with_raw_response.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=_LLM_TIMEOUT_S,
        )

    def measure(parsed):
        usage = parsed.usage
        return (parsed.choices[0].message.content or "",
                0, getattr(usage, "prompt_tokens", 0) or 0, getattr(usage, "completion_tokens", 0) or 0)

    return _controlled_call(uid, tipo, "llm", model, call, measure, est_tokens=est_tokens)
