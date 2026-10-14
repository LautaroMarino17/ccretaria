"""
Cupo de uso de IA por profesional y registro de uso.

El cupo se mide en segundos de audio enviados a Groq. "Hoy" y "este mes"
se calculan en la zona horaria APP_TIMEZONE (Argentina).

El registro NUNCA guarda audio, transcripciones, texto clínico ni datos del
paciente: record_usage() rechaza cualquier campo fuera de LOG_FIELDS.
"""
import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol

from ai_config import AIConfig, PlanQuota, get_ai_config
from services.ai_errors import IAPendiente

LOG_COLLECTION = "ai_usage_log"
COUNTERS_COLLECTION = "ai_usage_counters"
ALERTS_COLLECTION = "ai_alerts"

TIPOS = {"transcripcion", "estructuracion", "rutina_voz", "comando_voz"}
RESULTADOS = {"ok", "reintento", "rechazado_cupo", "error"}

# Campos que puede traer quien registra; fecha_hora / fecha_ar / mes_ar los pone record_usage
_INPUT_FIELDS = {
    "profesional_id", "tipo", "modelo", "segundos_audio", "tokens_entrada",
    "tokens_salida", "resultado", "codigo_error", "intento", "duracion_ms",
}
LOG_FIELDS = _INPUT_FIELDS | {"fecha_hora", "fecha_ar", "mes_ar"}
_MAX_STR = 64  # ningún campo de texto del registro necesita más (uid, modelo, código)


# ── Almacenamiento ────────────────────────────────────────────────────────────

class UsageStore(Protocol):
    def get_plan(self, uid: str) -> int: ...
    def get_counter(self, doc_id: str) -> dict: ...
    def get_counters(self, doc_ids: list[str]) -> list[dict]: ...
    def increment(self, doc_ids: list[str], fields: dict[str, float]) -> None: ...
    def add_log(self, entry: dict) -> None: ...
    def claim_alert(self, key: str) -> bool: ...


class FirestoreUsageStore:
    def __init__(self, db):
        self._db = db

    def get_plan(self, uid: str) -> int:
        # Mismo criterio que require_plan: sin doc o sin campo → plan 1
        doc = self._db.collection("professionals").document(uid).get()
        return int(doc.to_dict().get("plan", 1)) if doc.exists else 1

    def get_counter(self, doc_id: str) -> dict:
        doc = self._db.collection(COUNTERS_COLLECTION).document(doc_id).get()
        return doc.to_dict() if doc.exists else {}

    def get_counters(self, doc_ids: list[str]) -> list[dict]:
        refs = [self._db.collection(COUNTERS_COLLECTION).document(d) for d in doc_ids]
        by_id = {snap.id: (snap.to_dict() or {}) for snap in self._db.get_all(refs) if snap.exists}
        return [by_id.get(d, {}) for d in doc_ids]

    def increment(self, doc_ids: list[str], fields: dict[str, float]) -> None:
        from google.cloud.firestore_v1 import Increment
        batch = self._db.batch()
        for doc_id in doc_ids:
            ref = self._db.collection(COUNTERS_COLLECTION).document(doc_id)
            batch.set(ref, {k: Increment(v) for k, v in fields.items()}, merge=True)
        batch.commit()

    def add_log(self, entry: dict) -> None:
        self._db.collection(LOG_COLLECTION).add(entry)

    def claim_alert(self, key: str) -> bool:
        """True solo la primera vez que se pide esta clave (evita alertas repetidas)."""
        from google.api_core.exceptions import AlreadyExists
        try:
            self._db.collection(ALERTS_COLLECTION).document(key).create(
                {"fecha_hora": datetime.now(timezone.utc)})
            return True
        except AlreadyExists:
            return False


def day_key(uid: str, now: datetime) -> str:
    return f"{uid}_d_{now:%Y-%m-%d}"


def month_key(uid: str, now: datetime) -> str:
    return f"{uid}_m_{now:%Y-%m}"


# ── Estado del cupo ───────────────────────────────────────────────────────────

@dataclass(frozen=True)
class QuotaStatus:
    plan: int
    ilimitado: bool
    usado_dia_min: float
    usado_mes_min: float
    limite_dia_min: int | None
    limite_mes_min: int | None
    restante_min: float | None # lo que queda del tope más chico (None = sin tope)
    porcentaje: int            # el tope más cercano a agotarse
    aviso: bool                # >= AI_QUOTA_WARN_PCT
    bloqueado: bool            # >= 100 %
    mensaje: str | None
    renueva: str | None        # ISO 8601 en hora de Argentina
    sin_ia: bool = False       # el plan no incluye IA (bloquea también el texto)


def _fmt(minutes: float) -> str:
    h, m = divmod(int(minutes), 60)
    if not h:
        return f"{m} min"
    return f"{h} h" if not m else f"{h} h {m} min"


def _next_day(now: datetime) -> datetime:
    return (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)


def _next_month(now: datetime) -> datetime:
    first = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return (first + timedelta(days=32)).replace(day=1)


def _fmt_renew(renew: datetime, now: datetime) -> str:
    return "mañana" if renew.date() == (now + timedelta(days=1)).date() else f"el {renew:%d/%m}"


def compute_status(plan: int, quota: PlanQuota | None, used_day_s: float,
                   used_month_s: float, now: datetime, warn_pct: int) -> QuotaStatus:
    used_day, used_month = used_day_s / 60, used_month_s / 60

    if quota is None:  # plan sin IA (ej. plan 0)
        return QuotaStatus(plan, False, used_day, used_month, 0, 0, 0, 100, False, True,
                           "Tu plan no incluye funciones de IA.", None, sin_ia=True)
    if quota.audio_min_day is None and quota.audio_min_month is None:
        return QuotaStatus(plan, True, used_day, used_month, None, None, None, 0, False, False, None, None)

    # (porcentaje, límite, usado, etiqueta, renovación) de cada tope configurado
    checks = []
    if quota.audio_min_month is not None:
        lim = quota.audio_min_month
        checks.append((used_month / lim * 100 if lim else 100, lim, used_month, "del mes", _next_month(now)))
    if quota.audio_min_day is not None:
        lim = quota.audio_min_day
        checks.append((used_day / lim * 100 if lim else 100, lim, used_day, "de hoy", _next_day(now)))

    blocked = [c for c in checks if c[0] >= 100]
    if blocked:
        # Si se agotaron los dos, manda el que se renueva más tarde
        pct, lim, used, label, renew = max(blocked, key=lambda c: c[4])
        mensaje = f"Llegaste al límite {label}: {_fmt(lim)}. Se renueva {_fmt_renew(renew, now)} a las 00:00."
    else:
        pct, lim, used, label, renew = max(checks, key=lambda c: c[0])
        mensaje = (f"Usaste el {int(pct)} % de tu cupo {label} ({_fmt(used)} de {_fmt(lim)})."
                   if pct >= warn_pct else None)

    return QuotaStatus(
        plan=plan, ilimitado=False,
        usado_dia_min=used_day, usado_mes_min=used_month,
        limite_dia_min=quota.audio_min_day, limite_mes_min=quota.audio_min_month,
        restante_min=max(0.0, min(c[1] - c[2] for c in checks)),
        porcentaje=int(pct), aviso=pct >= warn_pct, bloqueado=bool(blocked),
        mensaje=mensaje, renueva=renew.isoformat(),
    )


def get_quota_status(store: UsageStore, uid: str, now: datetime | None = None,
                     cfg: AIConfig | None = None) -> QuotaStatus:
    cfg = cfg or get_ai_config()
    now = now or datetime.now(cfg.tz)
    plan = store.get_plan(uid)
    used_day = store.get_counter(day_key(uid, now)).get("segundos_audio", 0)
    used_month = store.get_counter(month_key(uid, now)).get("segundos_audio", 0)
    return compute_status(plan, cfg.quota_by_plan.get(plan), used_day, used_month, now, cfg.quota_warn_pct)


# ── Registro de uso ───────────────────────────────────────────────────────────

def record_usage(store: UsageStore, entry: dict, now: datetime | None = None,
                 cfg: AIConfig | None = None) -> None:
    """Guarda un intento contra Groq. Solo cuenta para el cupo si resultado == 'ok'."""
    extra = set(entry) - _INPUT_FIELDS
    if extra:
        # Solo nombres de campos en el error, nunca valores
        raise ValueError(f"Campos no permitidos en el registro de uso: {sorted(extra)}")
    if entry.get("tipo") not in TIPOS or entry.get("resultado") not in RESULTADOS:
        raise ValueError("tipo o resultado inválido en el registro de uso")
    for k, v in entry.items():
        if isinstance(v, str) and len(v) > _MAX_STR:
            raise ValueError(f"Valor demasiado largo en el campo {k} del registro de uso")
        if v is not None and not isinstance(v, (str, int, float)):
            raise ValueError(f"Tipo no permitido en el campo {k} del registro de uso")

    cfg = cfg or get_ai_config()
    now = now or datetime.now(cfg.tz)
    uid = entry["profesional_id"]
    doc = {
        "segundos_audio": 0, "tokens_entrada": 0, "tokens_salida": 0,
        "codigo_error": None, "intento": 1, "duracion_ms": 0,
        **entry,
        "fecha_hora": now.astimezone(timezone.utc),
        "fecha_ar": f"{now:%Y-%m-%d}",
        "mes_ar": f"{now:%Y-%m}",
    }
    store.add_log(doc)

    if doc["resultado"] == "ok":
        store.increment([day_key(uid, now), month_key(uid, now)], {
            "segundos_audio": doc["segundos_audio"],
            "requests": 1,
            "tokens_entrada": doc["tokens_entrada"],
            "tokens_salida": doc["tokens_salida"],
        })


# ── Uso de la cuenta Groq (compartida por todos los profesionales) ───────────

def _hour_key(t: datetime) -> str:
    return f"cuenta_h_{t:%Y%m%d%H}"


def account_limits(cfg: AIConfig) -> list[tuple[str, str, int, str]]:
    """(ventana, campo, límite, nombre) de cada límite de la cuenta."""
    return [
        ("minuto", "whisper_req", cfg.whisper_rpm, "Transcripción: pedidos por minuto"),
        ("dia", "whisper_req", cfg.whisper_rpd, "Transcripción: pedidos por día"),
        ("hora", "whisper_seg", cfg.whisper_ash, "Audio: segundos por hora"),
        ("dia", "whisper_seg", cfg.whisper_asd, "Audio: segundos por día"),
        ("minuto", "llm_req", cfg.llm_rpm, "Texto: pedidos por minuto"),
        ("dia", "llm_req", cfg.llm_rpd, "Texto: pedidos por día"),
        ("minuto", "llm_tokens", cfg.llm_tpm, "Texto: tokens por minuto"),
        ("dia", "llm_tokens", cfg.llm_tpd, "Texto: tokens por día"),
    ]


def _parse_reset(value: str | None) -> float | None:
    """Convierte '2m59.56s', '7.66s', '1h2m', '120ms' a segundos."""
    import re
    if not value:
        return None
    parts = re.findall(r"(\d+(?:\.\d+)?)(ms|h|m|s)", value)
    if not parts:
        try:
            return float(value)
        except ValueError:
            return None
    mult = {"h": 3600, "m": 60, "s": 1, "ms": 0.001}
    return sum(float(n) * mult[u] for n, u in parts)


class AccountTracker:
    """Uso de la cuenta Groq.

    - Último minuto: en memoria (Render corre una sola instancia).
    - Hora actual y últimas 24 h: contadores por hora UTC en Firestore (sobreviven reinicios).
    - Headers de Groq: lo último informado por cada modelo (pedidos del día, tokens del minuto).
    Hora y día se comparan contra el límite × GROQ_ACCOUNT_MARGIN_PCT; el minuto contra el límite
    completo (si no, un pedido grande nunca entraría y se reintenta solo en segundos).
    """
    _CACHE_S = 30

    def __init__(self, store: UsageStore, clock=time.time):
        self._store = store
        self._clock = clock
        self._events: deque = deque()   # (ts, campo, valor)
        self._hours: dict[str, dict] = {}
        self._hours_at = 0.0
        self._headers: dict[str, dict] = {}
        self._lock = threading.Lock()

    def _hour_keys(self) -> list[str]:
        base = datetime.fromtimestamp(self._clock(), timezone.utc).replace(minute=0, second=0, microsecond=0)
        return [_hour_key(base - timedelta(hours=i)) for i in range(24)]

    def _load_hours(self, keys: list[str]) -> dict[str, dict]:
        if self._clock() - self._hours_at > self._CACHE_S or keys[0] not in self._hours:
            self._hours = dict(zip(keys, self._store.get_counters(keys)))
            self._hours_at = self._clock()
        return self._hours

    def record(self, kind: str, audio_s: float = 0, tokens: int = 0) -> None:
        fields = ({"whisper_req": 1, "whisper_seg": audio_s} if kind == "whisper"
                  else {"llm_req": 1, "llm_tokens": tokens})
        key = self._hour_keys()[0]
        with self._lock:
            now = self._clock()
            for campo, valor in fields.items():
                self._events.append((now, campo, valor))
            if key in self._hours:
                for campo, valor in fields.items():
                    self._hours[key][campo] = self._hours[key].get(campo, 0) + valor
        self._store.increment([key], fields)

    def update_headers(self, model: str, headers) -> None:
        def _num(name):
            v = headers.get(name)
            try:
                return float(v) if v is not None else None
            except ValueError:
                return None
        with self._lock:
            self._headers[model] = {
                "at": self._clock(),
                "remaining_requests": _num("x-ratelimit-remaining-requests"),
                "reset_requests": _parse_reset(headers.get("x-ratelimit-reset-requests")),
                "remaining_tokens": _num("x-ratelimit-remaining-tokens"),
                "reset_tokens": _parse_reset(headers.get("x-ratelimit-reset-tokens")),
            }

    def snapshot(self) -> dict[str, dict[str, float]]:
        campos = ("whisper_req", "whisper_seg", "llm_req", "llm_tokens")
        keys = self._hour_keys()
        with self._lock:
            now = self._clock()
            while self._events and now - self._events[0][0] >= 60:
                self._events.popleft()
            minuto = {c: 0.0 for c in campos}
            for _, campo, valor in self._events:
                minuto[campo] += valor
            hours = self._load_hours(keys)
            hora = {c: float(hours.get(keys[0], {}).get(c, 0)) for c in campos}
            dia = {c: float(sum(hours.get(k, {}).get(c, 0) for k in keys)) for c in campos}
        return {"minuto": minuto, "hora": hora, "dia": dia}

    def usage(self, cfg: AIConfig) -> list[dict]:
        snap = self.snapshot()
        return [
            {"limite": nombre, "ventana": ventana, "campo": campo, "usado": round(snap[ventana][campo], 1),
             "maximo": lim, "porcentaje": int(snap[ventana][campo] / lim * 100) if lim else 100}
            for ventana, campo, lim, nombre in account_limits(cfg)
        ]

    def _wait_for(self, ventana: str, campo: str) -> float:
        now = self._clock()
        if ventana == "minuto":
            with self._lock:
                oldest = next((ts for ts, c, _ in self._events if c == campo), now)
            return max(1.0, 60 - (now - oldest) + 0.5)
        # hora y día: hasta que empiece la próxima hora UTC (cae el bucket más viejo)
        return max(60.0, 3600 - now % 3600)

    def check(self, cfg: AIConfig, kind: str, model: str, est_audio_s: float = 0, est_tokens: int = 0) -> None:
        """Levanta IAPendiente si la cuenta no tiene margen para este pedido."""
        extra = ({"whisper_req": 1, "whisper_seg": est_audio_s} if kind == "whisper"
                 else {"llm_req": 1, "llm_tokens": est_tokens})
        snap = self.snapshot()
        for ventana, campo, lim, _ in account_limits(cfg):
            if campo not in extra:
                continue
            tope = lim if ventana == "minuto" else lim * cfg.account_margin_pct / 100
            if snap[ventana][campo] + extra[campo] > tope:
                raise IAPendiente(self._wait_for(ventana, campo))

        with self._lock:
            h = self._headers.get(model)
        if not h:
            return
        elapsed = self._clock() - h["at"]
        if h["remaining_requests"] is not None and h["remaining_requests"] <= 0 \
                and h["reset_requests"] and elapsed < h["reset_requests"]:
            raise IAPendiente(h["reset_requests"] - elapsed)
        if kind == "llm" and h["remaining_tokens"] is not None and est_tokens > h["remaining_tokens"] \
                and h["reset_tokens"] and elapsed < h["reset_tokens"]:
            raise IAPendiente(h["reset_tokens"] - elapsed)
