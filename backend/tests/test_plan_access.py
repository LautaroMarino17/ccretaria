"""Restricciones por plan en /recording/transcribe-chunk (Amalia = Plan 3)."""
import os

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.example"))

import main  # noqa: E402
from services import groq_gateway as gw  # noqa: E402


@pytest.fixture
def client(monkeypatch, store, cfg):
    route = next(r for r in main.app.routes if getattr(r, "path", "") == "/recording/transcribe-chunk")
    user_dep = next(d.call for d in route.dependant.dependencies if d.name == "user")
    uid = {"value": "prof1"}
    main.app.dependency_overrides[user_dep] = lambda: {"uid": uid["value"], "role": "professional"}
    monkeypatch.setattr(gw, "_store", store)
    monkeypatch.setattr(gw, "get_ai_config", lambda: cfg)
    monkeypatch.setattr("routers.recording.transcribe_audio_file", lambda audio, u, tipo: f"ok:{tipo}")
    main.limiter.enabled = False
    yield TestClient(main.app), uid
    main.app.dependency_overrides.clear()
    main.limiter.enabled = True


def _post(c, origen):
    return c.post("/recording/transcribe-chunk", files={"audio": ("c.webm", b"x" * 100, "audio/webm")},
                  data={"origen": origen})


@pytest.mark.parametrize("uid", ["prof1", "prof2"])
def test_amalia_requiere_plan_3(client, uid):
    c, current = client
    current["value"] = uid
    r = _post(c, "amalia")
    assert r.status_code == 403


def test_amalia_con_plan_3(client):
    c, current = client
    current["value"] = "prof3"
    assert _post(c, "amalia").json() == {"text": "ok:comando_voz"}


def test_grabacion_de_consulta_con_plan_1(client):
    c, _ = client
    assert _post(c, "consulta").json() == {"text": "ok:transcripcion"}
