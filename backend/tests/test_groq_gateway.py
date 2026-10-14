"""Gateway de Groq con Groq y Firestore simulados."""
import logging
from types import SimpleNamespace

import groq
import httpx
import pytest

from services import groq_gateway as gw
from services.ai_errors import CupoAgotado, IAPendiente, TextoDemasiadoLargo
from services.ai_usage_service import AccountTracker, LOG_FIELDS

CLINICO = "Paciente Juan Pérez, DNI 30111222, refiere dolor lumbar con irradiación"


# ── Groq simulado ─────────────────────────────────────────────────────────────

def _http_error(cls, status, headers=None, message="error"):
    req = httpx.Request("POST", "https://api.groq.com/openai/v1/x")
    return cls(message, response=httpx.Response(status, headers=headers or {}, request=req), body=None)


def rate_limit(retry_after=None):
    return _http_error(groq.RateLimitError, 429, {"retry-after": str(retry_after)} if retry_after else {})


def whisper_ok(text="texto", duration=60.0):
    return SimpleNamespace(headers={"x-ratelimit-remaining-requests": "1999"},
                           parse=lambda: SimpleNamespace(text=text, duration=duration))


def chat_ok(content="{}", tok_in=500, tok_out=200):
    return SimpleNamespace(
        headers={"x-ratelimit-remaining-requests": "999", "x-ratelimit-remaining-tokens": "7000",
                 "x-ratelimit-reset-tokens": "7.5s"},
        parse=lambda: SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
            usage=SimpleNamespace(prompt_tokens=tok_in, completion_tokens=tok_out)))


class FakeEndpoint:
    def __init__(self):
        self.outcomes = []
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class FakeGroq:
    def __init__(self):
        self.whisper = FakeEndpoint()
        self.chat_ep = FakeEndpoint()
        self.audio = SimpleNamespace(transcriptions=SimpleNamespace(with_raw_response=self.whisper))
        self.chat = SimpleNamespace(completions=SimpleNamespace(with_raw_response=self.chat_ep))


@pytest.fixture
def env(monkeypatch, store, cfg):
    client = FakeGroq()
    sleeps = []
    monkeypatch.setattr(gw, "_client", client)
    monkeypatch.setattr(gw, "_store", store)
    monkeypatch.setattr(gw, "_tracker", AccountTracker(store))
    monkeypatch.setattr(gw, "_sleep", sleeps.append)
    monkeypatch.setattr(gw, "get_ai_config", lambda: cfg)
    return SimpleNamespace(client=client, store=store, sleeps=sleeps)


def _audio(seconds):
    return b"\x00" * int(seconds * 4000)


def _resultados(store):
    return [log["resultado"] for log in store.logs]


# ── Llamadas OK ───────────────────────────────────────────────────────────────

def test_transcripcion_ok_descuenta_los_segundos_reales(env):
    env.client.whisper.outcomes = [whisper_ok(duration=118.4)]
    assert gw.transcribe("prof1", "transcripcion", _audio(120), "a.webm") == "texto"
    assert env.store.logs[0]["segundos_audio"] == 118.4
    assert env.client.whisper.calls[0]["response_format"] == "verbose_json"
    day = next(v for k, v in env.store.counters.items() if k.startswith("prof1_d_"))
    assert day["segundos_audio"] == 118.4


def test_audio_corto_se_cobra_minimo_10_segundos(env):
    env.client.whisper.outcomes = [whisper_ok(duration=3.2)]
    gw.transcribe("prof1", "comando_voz", _audio(3), "a.webm")
    assert env.store.logs[0]["segundos_audio"] == 10


def test_chat_registra_tokens(env):
    env.client.chat_ep.outcomes = [chat_ok(tok_in=1234, tok_out=321)]
    gw.chat("prof1", "estructuracion", "openai/gpt-oss-120b", "prompt", 0.2, 2048)
    log = env.store.logs[0]
    assert (log["tokens_entrada"], log["tokens_salida"], log["segundos_audio"]) == (1234, 321, 0)


# ── 429 y reintentos ──────────────────────────────────────────────────────────

def test_429_reintenta_respetando_retry_after(env):
    env.client.whisper.outcomes = [rate_limit(retry_after=5), whisper_ok()]
    assert gw.transcribe("prof1", "transcripcion", _audio(60), "a.webm") == "texto"
    assert env.sleeps == [5.0]  # retry-after (5) > espera base (2)
    assert _resultados(env.store) == ["reintento", "ok"]


def test_429_sin_retry_after_usa_espera_creciente(env):
    env.client.whisper.outcomes = [rate_limit(), rate_limit(), whisper_ok()]
    gw.transcribe("prof1", "transcripcion", _audio(60), "a.webm")
    assert env.sleeps == [2, 4]
    assert _resultados(env.store) == ["reintento", "reintento", "ok"]


def test_429_persistente_queda_pendiente_sin_error_crudo(env):
    env.client.whisper.outcomes = [rate_limit(), rate_limit(), rate_limit()]
    with pytest.raises(IAPendiente) as exc:
        gw.transcribe("prof1", "transcripcion", _audio(60), "a.webm")
    assert exc.value.payload["mensaje"] == "Procesando, puede demorar."
    assert exc.value.status_code == 503
    assert len(env.client.whisper.calls) == 3  # GROQ_RETRY_MAX_ATTEMPTS
    assert _resultados(env.store) == ["reintento", "reintento", "error"]
    assert env.store.logs[-1]["codigo_error"] == "429"
    assert not any(k.startswith("prof1_d_") for k in env.store.counters)  # no descuenta cupo


def test_retry_after_largo_no_bloquea_el_servidor(env):
    env.client.chat_ep.outcomes = [rate_limit(retry_after=90)]
    with pytest.raises(IAPendiente) as exc:
        gw.chat("prof1", "estructuracion", "m", "prompt", 0.2, 100)
    assert env.sleeps == []  # 90 s > GROQ_RETRY_MAX_WAIT_SECONDS: no espera, queda pendiente
    assert exc.value.payload["reintentar_en"] == 90


def test_error_5xx_se_reintenta(env):
    env.client.chat_ep.outcomes = [_http_error(groq.InternalServerError, 503), chat_ok()]
    gw.chat("prof1", "estructuracion", "m", "prompt", 0.2, 100)
    assert _resultados(env.store) == ["reintento", "ok"]


def test_413_no_se_reintenta(env):
    env.client.chat_ep.outcomes = [_http_error(groq.APIStatusError, 413)]
    with pytest.raises(TextoDemasiadoLargo):
        gw.chat("prof1", "estructuracion", "m", "prompt", 0.2, 100)
    assert len(env.client.chat_ep.calls) == 1


def test_pedido_que_supera_tokens_por_minuto_no_llama_a_groq(env):
    with pytest.raises(TextoDemasiadoLargo):
        gw.chat("prof1", "estructuracion", "m", "x" * 40_000, 0.2, 2048)  # ~10k + 2k > 8k
    assert env.client.chat_ep.calls == []


# ── Cupo del profesional ──────────────────────────────────────────────────────

def test_cupo_agotado_bloquea_audio_sin_llamar_a_groq(env):
    env.store.counters["prof1_m_" + _mes()] = {"segundos_audio": 1950 * 60}
    with pytest.raises(CupoAgotado) as exc:
        gw.transcribe("prof1", "transcripcion", _audio(60), "a.webm")
    assert exc.value.payload["mensaje"].startswith("Llegaste al límite del mes")
    assert env.client.whisper.calls == []
    assert _resultados(env.store) == ["rechazado_cupo"]


def test_cupo_agotado_permite_estructurar_lo_ya_grabado(env):
    env.store.counters["prof1_m_" + _mes()] = {"segundos_audio": 1950 * 60}
    env.client.chat_ep.outcomes = [chat_ok()]
    gw.chat("prof1", "estructuracion", "m", "prompt", 0.2, 100)  # no levanta


def test_plan_0_no_usa_ia(env):
    with pytest.raises(CupoAgotado):
        gw.chat("prof0", "comando_voz", "m", "prompt", 0.2, 100)


@pytest.mark.parametrize("uid", ["prof2", "prof3"])
def test_planes_2_y_3_sin_tope(env, uid):
    env.store.counters[f"{uid}_m_" + _mes()] = {"segundos_audio": 999_999}
    env.client.whisper.outcomes = [whisper_ok()]
    gw.transcribe(uid, "transcripcion", _audio(60), "a.webm")


# ── Margen de la cuenta ───────────────────────────────────────────────────────

def test_sin_margen_en_la_cuenta_queda_pendiente_sin_llamar(env, cfg):
    tracker = gw._tracker
    key = tracker._hour_keys()[0]
    env.store.counters[key] = {"whisper_seg": cfg.whisper_ash * 0.9 - 30}  # casi el 90 % de la hora
    with pytest.raises(IAPendiente):
        gw.transcribe("prof1", "transcripcion", _audio(60), "a.webm")
    assert env.client.whisper.calls == []


def test_limite_por_minuto_espera_y_sigue(env, cfg, monkeypatch):
    clock = [1_000_000.0]
    tracker = AccountTracker(env.store, clock=lambda: clock[0])
    monkeypatch.setattr(gw, "_tracker", tracker)
    for _ in range(cfg.whisper_rpm):
        tracker.record("whisper", audio_s=10)
    clock[0] += 45  # el minuto se libera en ~15 s

    def fake_sleep(s):
        env.sleeps.append(s)
        clock[0] += s
    monkeypatch.setattr(gw, "_sleep", fake_sleep)

    env.client.whisper.outcomes = [whisper_ok()]
    assert gw.transcribe("prof1", "transcripcion", _audio(60), "a.webm") == "texto"
    assert env.sleeps == [16]  # 15,5 s redondeado hacia arriba


def test_limite_por_minuto_con_espera_larga_queda_pendiente(env, cfg):
    for _ in range(cfg.whisper_rpm):
        gw._tracker.record("whisper", audio_s=10)
    with pytest.raises(IAPendiente) as exc:  # habría que esperar ~60 s > 20 s
        gw.transcribe("prof1", "transcripcion", _audio(60), "a.webm")
    assert env.sleeps == [] and exc.value.payload["reintentar_en"] >= 60
    assert env.client.whisper.calls == []


# ── Alertas ───────────────────────────────────────────────────────────────────

def test_alerta_al_80_del_profesional_una_sola_vez(env, caplog):
    env.client.whisper.outcomes = [whisper_ok(duration=73 * 60), whisper_ok(duration=60)]
    with caplog.at_level(logging.WARNING, logger="secretaria.ia"):
        gw.transcribe("prof1", "transcripcion", _audio(120), "a.webm")
        gw.transcribe("prof1", "transcripcion", _audio(60), "a.webm")
    alertas = [r for r in caplog.records if "[ALERTA]" in r.getMessage()]
    assert len(alertas) == 1 and "cupo diario" in alertas[0].getMessage()


# ── Privacidad ────────────────────────────────────────────────────────────────

def test_registro_y_logs_sin_contenido_clinico(env, caplog):
    env.client.whisper.outcomes = [rate_limit(), whisper_ok(text=CLINICO)]
    env.client.chat_ep.outcomes = [
        _http_error(groq.BadRequestError, 400, message=f"invalid input: {CLINICO}"),
        chat_ok(content=f'{{"nombre_paciente": "{CLINICO}"}}'),
    ]
    with caplog.at_level(logging.DEBUG):
        texto = gw.transcribe("prof1", "transcripcion", _audio(60), "consulta.webm")
        with pytest.raises(Exception):
            gw.chat("prof1", "estructuracion", "m", "Transcripción: " + texto, 0.2, 100)
        gw.chat("prof1", "estructuracion", "m", "Transcripción: " + texto, 0.2, 100)

    assert texto == CLINICO  # el texto vuelve al llamador...
    for log in env.store.logs:  # ...pero no queda en el registro
        assert set(log) <= LOG_FIELDS
        for value in log.values():
            for fragmento in ("Juan", "Pérez", "30111222", "lumbar", "consulta.webm"):
                assert fragmento not in str(value)
    for fragmento in ("Juan", "Pérez", "30111222", "lumbar"):
        assert fragmento not in caplog.text


def _mes():
    from datetime import datetime
    from conftest import AR
    return f"{datetime.now(AR):%Y-%m}"
