from datetime import datetime

import pytest

from conftest import AR
from services.ai_usage_service import LOG_FIELDS, get_quota_status, record_usage

NOW = datetime(2026, 10, 14, 15, 0, tzinfo=AR)


def _use(store, cfg, uid, minutes, now=NOW, resultado="ok"):
    record_usage(store, {
        "profesional_id": uid, "tipo": "transcripcion", "modelo": "whisper-large-v3",
        "segundos_audio": minutes * 60, "resultado": resultado,
    }, now=now, cfg=cfg)


# ── Cupo diario ───────────────────────────────────────────────────────────────

def test_debajo_del_80_no_avisa_ni_bloquea(store, cfg):
    _use(store, cfg, "prof1", 60)
    s = get_quota_status(store, "prof1", now=NOW, cfg=cfg)
    assert (s.aviso, s.bloqueado, s.mensaje) == (False, False, None)
    assert s.usado_dia_min == 60


def test_aviso_al_80_del_diario(store, cfg):
    _use(store, cfg, "prof1", 72)  # 72 de 90 = 80 %
    s = get_quota_status(store, "prof1", now=NOW, cfg=cfg)
    assert s.aviso and not s.bloqueado
    assert s.mensaje == "Usaste el 80 % de tu cupo de hoy (1 h 12 min de 1 h 30 min)."


def test_bloqueo_al_100_del_diario(store, cfg):
    _use(store, cfg, "prof1", 90)
    s = get_quota_status(store, "prof1", now=NOW, cfg=cfg)
    assert s.bloqueado
    assert s.mensaje == "Llegaste al límite de hoy: 1 h 30 min. Se renueva mañana a las 00:00."


def test_el_diario_se_renueva_a_medianoche_argentina(store, cfg):
    # 23:59 hora Argentina = 02:59 UTC del día siguiente: debe contar para el 14
    _use(store, cfg, "prof1", 90, now=datetime(2026, 10, 14, 23, 59, tzinfo=AR))
    assert get_quota_status(store, "prof1", now=datetime(2026, 10, 14, 23, 59, 30, tzinfo=AR), cfg=cfg).bloqueado
    s = get_quota_status(store, "prof1", now=datetime(2026, 10, 15, 0, 0, tzinfo=AR), cfg=cfg)
    assert not s.bloqueado and s.usado_dia_min == 0
    assert s.usado_mes_min == 90  # el mes sigue acumulando


# ── Cupo mensual ──────────────────────────────────────────────────────────────

def test_aviso_al_80_del_mensual(store, cfg):
    for day in range(1, 19):  # 18 días × 87 min = 1566 min ≈ 80,3 % de 1950
        _use(store, cfg, "prof1", 87, now=datetime(2026, 10, day, 10, 0, tzinfo=AR))
    s = get_quota_status(store, "prof1", now=datetime(2026, 10, 19, 10, 0, tzinfo=AR), cfg=cfg)
    assert s.aviso and not s.bloqueado
    assert s.mensaje.startswith("Usaste el 80 % de tu cupo del mes")


def test_bloqueo_al_100_del_mensual(store, cfg):
    for day in range(1, 23):  # 22 días × 90 min = 1980 min > 1950
        _use(store, cfg, "prof1", 90, now=datetime(2026, 10, day, 10, 0, tzinfo=AR))
    s = get_quota_status(store, "prof1", now=datetime(2026, 10, 23, 10, 0, tzinfo=AR), cfg=cfg)
    assert s.bloqueado and s.usado_dia_min == 0
    assert s.mensaje == "Llegaste al límite del mes: 32 h 30 min. Se renueva el 01/11 a las 00:00."


def test_si_se_agotan_los_dos_manda_el_mensual(store, cfg):
    for day in range(1, 23):
        _use(store, cfg, "prof1", 90, now=datetime(2026, 10, day, 10, 0, tzinfo=AR))
    s = get_quota_status(store, "prof1", now=datetime(2026, 10, 22, 18, 0, tzinfo=AR), cfg=cfg)
    assert "del mes" in s.mensaje


def test_el_mensual_se_renueva_el_dia_1(store, cfg):
    store.counters["prof1_m_2026-10"] = {"segundos_audio": 1950 * 60}
    assert get_quota_status(store, "prof1", now=datetime(2026, 10, 31, 23, 59, tzinfo=AR), cfg=cfg).bloqueado
    s = get_quota_status(store, "prof1", now=datetime(2026, 11, 1, 0, 0, tzinfo=AR), cfg=cfg)
    assert not s.bloqueado and s.usado_mes_min == 0


# ── Planes ────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("uid", ["prof2", "prof3"])
def test_planes_2_y_3_sin_tope(store, cfg, uid):
    _use(store, cfg, uid, 5000)
    s = get_quota_status(store, uid, now=NOW, cfg=cfg)
    assert s.ilimitado and not s.aviso and not s.bloqueado
    assert s.usado_dia_min == 5000  # el uso igual se registra


def test_plan_0_sin_ia(store, cfg):
    s = get_quota_status(store, "prof0", now=NOW, cfg=cfg)
    assert s.bloqueado and s.mensaje == "Tu plan no incluye funciones de IA."


# ── Registro de uso ───────────────────────────────────────────────────────────

def test_solo_los_ok_descuentan_cupo(store, cfg):
    _use(store, cfg, "prof1", 30, resultado="error")
    _use(store, cfg, "prof1", 30, resultado="reintento")
    _use(store, cfg, "prof1", 30, resultado="rechazado_cupo")
    assert get_quota_status(store, "prof1", now=NOW, cfg=cfg).usado_dia_min == 0
    assert len(store.logs) == 3


def test_el_registro_solo_tiene_campos_permitidos(store, cfg):
    _use(store, cfg, "prof1", 1)
    assert set(store.logs[0]) <= LOG_FIELDS
    assert store.logs[0]["fecha_ar"] == "2026-10-14" and store.logs[0]["mes_ar"] == "2026-10"


@pytest.mark.parametrize("campo", ["transcripcion", "texto", "patient_id", "nombre_paciente", "audio"])
def test_el_registro_rechaza_contenido_clinico(store, cfg, campo):
    with pytest.raises(ValueError) as exc:
        record_usage(store, {
            "profesional_id": "prof1", "tipo": "transcripcion", "modelo": "whisper-large-v3",
            "resultado": "ok", campo: "Paciente Juan Pérez, dolor lumbar",
        }, now=NOW, cfg=cfg)
    assert "Juan Pérez" not in str(exc.value)  # el error no repite el contenido
    assert store.logs == []


def test_el_registro_rechaza_texto_largo_en_campos_permitidos(store, cfg):
    with pytest.raises(ValueError):
        record_usage(store, {
            "profesional_id": "prof1", "tipo": "transcripcion", "resultado": "error",
            "modelo": "whisper-large-v3",
            "codigo_error": "El paciente refiere dolor lumbar desde hace tres semanas con irradiación",
        }, now=NOW, cfg=cfg)
    assert store.logs == []
