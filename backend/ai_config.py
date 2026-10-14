"""
Límites de uso de IA (Groq), leídos de variables de entorno.
Ningún límite tiene valor por defecto en el código: si falta uno obligatorio, el backend no arranca.
"""
import os
from dataclasses import dataclass
from functools import lru_cache
from zoneinfo import ZoneInfo


def _get(name: str, required: bool = True) -> str | None:
    raw = os.getenv(name, "").strip()
    if not raw and required:
        raise RuntimeError(f"Falta la variable de entorno {name} (límites de IA)")
    return raw or None


def _int(name: str, required: bool = True) -> int | None:
    raw = _get(name, required)
    return int(raw) if raw is not None else None


@dataclass(frozen=True)
class PlanQuota:
    audio_min_month: int | None    # None = sin tope
    audio_min_day: int | None      # None = sin tope


def _plan_quotas() -> dict[int, PlanQuota]:
    """Lee AI_QUOTA_PLAN{n}_AUDIO_MIN_MONTH / _DAY. Plan sin variables = uso libre."""
    return {
        plan: PlanQuota(
            audio_min_month=_int(f"AI_QUOTA_PLAN{plan}_AUDIO_MIN_MONTH", required=False),
            audio_min_day=_int(f"AI_QUOTA_PLAN{plan}_AUDIO_MIN_DAY", required=False),
        )
        for plan in (1, 2, 3)
    }


@dataclass(frozen=True)
class AIConfig:
    tz: ZoneInfo
    # Cupo por plan del profesional (minutos de audio)
    quota_by_plan: dict[int, PlanQuota]
    quota_warn_pct: int
    # Límites de la cuenta Groq
    whisper_model: str
    whisper_rpm: int
    whisper_rpd: int
    whisper_ash: int                   # segundos de audio por hora
    whisper_asd: int                   # segundos de audio por día
    llm_rpm: int
    llm_rpd: int
    llm_tpm: int
    llm_tpd: int
    account_margin_pct: int            # se deja de llamar al superar este % de la cuenta
    # Reintentos ante 429
    retry_max_attempts: int
    retry_base_seconds: int
    retry_max_wait_seconds: int
    # Alertas
    alert_email: str | None


@lru_cache
def get_ai_config() -> AIConfig:
    return AIConfig(
        tz=ZoneInfo(_get("APP_TIMEZONE")),
        quota_by_plan=_plan_quotas(),
        quota_warn_pct=_int("AI_QUOTA_WARN_PCT"),
        whisper_model=_get("GROQ_WHISPER_MODEL"),
        whisper_rpm=_int("GROQ_LIMIT_WHISPER_RPM"),
        whisper_rpd=_int("GROQ_LIMIT_WHISPER_RPD"),
        whisper_ash=_int("GROQ_LIMIT_WHISPER_ASH"),
        whisper_asd=_int("GROQ_LIMIT_WHISPER_ASD"),
        llm_rpm=_int("GROQ_LIMIT_LLM_RPM"),
        llm_rpd=_int("GROQ_LIMIT_LLM_RPD"),
        llm_tpm=_int("GROQ_LIMIT_LLM_TPM"),
        llm_tpd=_int("GROQ_LIMIT_LLM_TPD"),
        account_margin_pct=_int("GROQ_ACCOUNT_MARGIN_PCT"),
        retry_max_attempts=_int("GROQ_RETRY_MAX_ATTEMPTS"),
        retry_base_seconds=_int("GROQ_RETRY_BASE_SECONDS"),
        retry_max_wait_seconds=_int("GROQ_RETRY_MAX_WAIT_SECONDS"),
        alert_email=_get("AI_ALERT_EMAIL", required=False),
    )
