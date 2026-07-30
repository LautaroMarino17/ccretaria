from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from dependencies import get_current_user
from services.firebase_service import get_firestore
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


@router.patch("/professionals/{uid}/plan")
def update_professional_plan(uid: str, body: UpdatePlanRequest, user: dict = Depends(get_current_user)):
    """Actualiza el plan de un profesional (1, 2 o 3)."""
    _require_admin(user)
    if body.plan not in (0, 1, 2, 3):
        raise HTTPException(status_code=400, detail="Plan debe ser 1, 2 o 3")
    db = get_firestore()
    db.collection("professionals").document(uid).set({"plan": body.plan}, merge=True)
    return {"uid": uid, "plan": body.plan}
