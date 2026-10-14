import os
import sys
from zoneinfo import ZoneInfo

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_config import AIConfig, PlanQuota  # noqa: E402

AR = ZoneInfo("America/Argentina/Buenos_Aires")


class InMemoryUsageStore:
    """Reemplazo de Firestore para tests."""

    def __init__(self, plans: dict[str, int] | None = None):
        self.plans = plans or {}
        self.counters: dict[str, dict] = {}
        self.logs: list[dict] = []
        self.alerts: set[str] = set()

    def get_plan(self, uid):
        return self.plans.get(uid, 1)

    def get_counter(self, doc_id):
        return dict(self.counters.get(doc_id, {}))

    def get_counters(self, doc_ids):
        return [dict(self.counters.get(d, {})) for d in doc_ids]

    def claim_alert(self, key):
        if key in self.alerts:
            return False
        self.alerts.add(key)
        return True

    def increment(self, doc_ids, fields):
        for doc_id in doc_ids:
            c = self.counters.setdefault(doc_id, {})
            for k, v in fields.items():
                c[k] = c.get(k, 0) + v

    def add_log(self, entry):
        self.logs.append(dict(entry))


@pytest.fixture
def cfg():
    return AIConfig(
        tz=AR,
        quota_by_plan={1: PlanQuota(1950, 90), 2: PlanQuota(None, None), 3: PlanQuota(None, None)},
        quota_warn_pct=80,
        whisper_model="whisper-large-v3",
        whisper_rpm=20, whisper_rpd=2000, whisper_ash=7200, whisper_asd=28800,
        llm_rpm=30, llm_rpd=1000, llm_tpm=8000, llm_tpd=200000,
        account_margin_pct=90,
        retry_max_attempts=3, retry_base_seconds=2, retry_max_wait_seconds=20,
        alert_email=None,
    )


@pytest.fixture
def store():
    return InMemoryUsageStore(plans={"prof1": 1, "prof2": 2, "prof3": 3, "prof0": 0})
