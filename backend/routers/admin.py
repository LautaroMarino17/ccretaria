from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from ai_config import get_ai_config
from dependencies import get_current_user
from services.ai_usage_service import compute_status, day_key, month_key
from services.firebase_service import get_firestore
from services.groq_gateway import get_store, get_tracker
from firebase_admin import auth as fb_auth

router = APIRouter()


def _require_admin(user: dict):
    db = get_firestore()
    doc = db.collection("professionals").document(user["uid"]).get()
    if not doc.exists or not doc.to_dict().get("is_admin", False):
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores")
    return user


@router.get("/professionals")
def list_professionals(user: dict = Depends(get_current_user)):
    """Lista todos los profesionales con su plan actual."""
    _require_admin(user)
    db = get_firestore()
    docs = list(db.collection("professionals").stream())
    result = []
    for doc in docs:
        data = doc.to_dict()
        uid = doc.id
        try:
            fb_user = fb_auth.get_user(uid)
            result.append({
                "uid": uid,
                "email": fb_user.email or "",
                "display_name": fb_user.display_name or "",
                "plan": int(data.get("plan", 1)),
                "is_admin": bool(data.get("is_admin", False)),
            })
        except Exception:
            pass
    return result


class UpdatePlanRequest(BaseModel):
    plan: int


@router.get("/ai-usage")
def ai_usage(user: dict = Depends(get_current_user)):
    """Uso de IA por profesional (hoy y mes, hora Argentina) y de la cuenta Groq
    (último minuto, hora y 24 h) contra los límites configurados. Sin contenido clínico."""
    _require_admin(user)
    cfg = get_ai_config()
    store = get_store()
    now = datetime.now(cfg.tz)
    db = get_firestore()

    docs = list(db.collection("professionals").stream())
    keys = [k for d in docs for k in (day_key(d.id, now), month_key(d.id, now))]
    counters = dict(zip(keys, store.get_counters(keys))) if keys else {}

    def _resumen(c: dict) -> dict:
        return {
            "minutos_audio": round(c.get("segundos_audio", 0) / 60, 1),
            "requests": int(c.get("requests", 0)),
            "tokens": int(c.get("tokens_entrada", 0) + c.get("tokens_salida", 0)),
        }

    profesionales = []
    for d in docs:
        plan = int(d.to_dict().get("plan", 1))
        dia, mes = counters[day_key(d.id, now)], counters[month_key(d.id, now)]
        status = compute_status(plan, cfg.quota_by_plan.get(plan), dia.get("segundos_audio", 0),
                                mes.get("segundos_audio", 0), now, cfg.quota_warn_pct)
        try:
            fb_user = fb_auth.get_user(d.id)
            email, nombre = fb_user.email or "", fb_user.display_name or ""
        except Exception:
            email, nombre = "", ""
        profesionales.append({
            "uid": d.id, "email": email, "display_name": nombre, "plan": plan,
            "hoy": _resumen(dia), "mes": _resumen(mes),
            "limite_dia_min": status.limite_dia_min, "limite_mes_min": status.limite_mes_min,
            "ilimitado": status.ilimitado, "porcentaje": status.porcentaje,
            "aviso": status.aviso, "bloqueado": status.bloqueado,
        })
    profesionales.sort(key=lambda p: p["mes"]["minutos_audio"], reverse=True)

    return {
        "fecha_ar": f"{now:%Y-%m-%d %H:%M}",
        "cuenta": get_tracker().usage(cfg),
        "margen_cuenta_pct": cfg.account_margin_pct,
        "aviso_pct": cfg.quota_warn_pct,
        "profesionales": profesionales,
    }


@router.patch("/professionals/{uid}/plan")
def update_professional_plan(uid: str, body: UpdatePlanRequest, user: dict = Depends(get_current_user)):
    """Actualiza el plan de un profesional (1, 2 o 3)."""
    _require_admin(user)
    if body.plan not in (0, 1, 2, 3):
        raise HTTPException(status_code=400, detail="Plan debe ser 1, 2 o 3")
    db = get_firestore()
    db.collection("professionals").document(uid).set({"plan": body.plan}, merge=True)
    return {"uid": uid, "plan": body.plan}
