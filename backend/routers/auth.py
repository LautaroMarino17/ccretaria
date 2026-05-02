from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from dependencies import get_current_user, require_professional
from services.firebase_service import set_user_role, get_user, get_firestore
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class SetRoleRequest(BaseModel):
    uid: str
    role: str


@router.post("/set-role")
def set_role(body: SetRoleRequest):
    """Asigna el rol profesional al usuario recién registrado."""
    try:
        set_user_role(body.uid, body.role)
        if body.role == "professional":
            db = get_firestore()
            db.collection("professionals").document(body.uid).set({
                "uid": body.uid,
                "created_at": SERVER_TIMESTAMP
            }, merge=True)
        return {"message": f"Rol '{body.role}' asignado al usuario {body.uid}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    """Retorna la información del usuario autenticado, incluyendo el link_code si es profesional."""
    try:
        profile = get_user(user["uid"])
        result = {
            "uid": profile["uid"],
            "email": profile["email"],
            "display_name": profile["display_name"],
            "role": profile["custom_claims"].get("role", None),
            "link_code": None
        }

        if result["role"] == "professional":
            db = get_firestore()
            doc = db.collection("professionals").document(user["uid"]).get()
            if doc.exists:
                result["link_code"] = doc.to_dict().get("link_code")

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ProfessionalProfileUpdate(BaseModel):
    telefono: Optional[str] = None
    lugares_atencion: Optional[List[str]] = None


@router.get("/professional-profile")
def get_professional_profile(user: dict = Depends(get_current_user)):
    """Profesional: obtiene su perfil (teléfono y lugares de atención)."""
    require_professional(user)
    db = get_firestore()
    doc = db.collection("professionals").document(user["uid"]).get()
    data = doc.to_dict() if doc.exists else {}
    return {
        "telefono": data.get("telefono", ""),
        "lugares_atencion": data.get("lugares_atencion", [])
    }


@router.patch("/professional-profile")
def update_professional_profile(body: ProfessionalProfileUpdate, user: dict = Depends(get_current_user)):
    """Profesional: actualiza teléfono y/o lugares de atención."""
    require_professional(user)
    db = get_firestore()
    updates = {}
    if body.telefono is not None:
        updates["telefono"] = body.telefono
    if body.lugares_atencion is not None:
        updates["lugares_atencion"] = body.lugares_atencion
    if not updates:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    db.collection("professionals").document(user["uid"]).set(updates, merge=True)
    return {"message": "Perfil actualizado"}


@router.post("/admin/sync-registry")
def sync_patient_registry(user: dict = Depends(get_current_user)):
    """Profesional: reconstruye el patient_registry escaneando sus propios pacientes.
    Útil para migrar datos existentes al nuevo modelo."""
    require_professional(user)
    db = get_firestore()
    from routers.patients import _register_patient
    patients = db.collection("professionals").document(user["uid"]).collection("patients").stream()
    synced = 0
    for p in patients:
        pdata = p.to_dict()
        dni = (pdata.get("dni") or "").strip()
        email = (pdata.get("email") or "").strip().lower()
        if dni:
            try:
                _register_patient(db, user["uid"], p.id, dni, email)
                synced += 1
            except Exception:
                pass
    return {"synced": synced, "message": f"Registry sincronizado: {synced} pacientes"}
