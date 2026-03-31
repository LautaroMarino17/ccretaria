import random
import string
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from dependencies import get_current_user, require_professional
from services.firebase_service import set_user_role, get_user, get_firestore
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class SetRoleRequest(BaseModel):
    uid: str
    role: str


def _generate_code() -> str:
    """Genera un código legible tipo DR-A3X9."""
    chars = string.ascii_uppercase + string.digits
    suffix = ''.join(random.choices(chars, k=4))
    return f"DR-{suffix}"


@router.post("/set-role")
def set_role(body: SetRoleRequest):
    """Asigna el rol y genera el código de vinculación si es profesional."""
    try:
        set_user_role(body.uid, body.role)

        if body.role == "professional":
            db = get_firestore()
            prof_ref = db.collection("professionals").document(body.uid)
            doc = prof_ref.get()

            # Solo genera código si no tiene uno ya
            if not doc.exists or not doc.to_dict().get("link_code"):
                # Garantizar que el código sea único
                code = _generate_code()
                while True:
                    existing = db.collection("professionals") \
                        .where("link_code", "==", code).limit(1).stream()
                    if not any(True for _ in existing):
                        break
                    code = _generate_code()

                prof_ref.set({
                    "uid": body.uid,
                    "link_code": code,
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


@router.get("/link-code")
def get_link_code(user: dict = Depends(get_current_user)):
    """Profesional: obtiene su código de vinculación."""
    require_professional(user)
    db = get_firestore()
    doc = db.collection("professionals").document(user["uid"]).get()
    if not doc.exists or not doc.to_dict().get("link_code"):
        raise HTTPException(status_code=404, detail="No tenés código generado. Cerrá sesión y volvé a entrar.")
    return {"link_code": doc.to_dict()["link_code"]}


class LinkProfessionalRequest(BaseModel):
    link_code: str


@router.post("/link-professional")
def link_to_professional(body: LinkProfessionalRequest, user: dict = Depends(get_current_user)):
    """Paciente: se vincula a un profesional usando el código DR-XXXX.
    Guarda professional_uid y patient_doc_id en patient_links/{uid} para acceso directo."""
    if user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Solo pacientes pueden vincularse")

    db = get_firestore()
    code = body.link_code.upper().strip()

    # Buscar el profesional por código
    prof_docs = db.collection("professionals").where("link_code", "==", code).limit(1).stream()
    prof_doc = next(prof_docs, None)
    if prof_doc is None:
        raise HTTPException(status_code=404, detail="Código inválido")

    prof_uid = prof_doc.id

    # Buscar el doc del paciente en la subcolección del profesional por email
    patient_docs = db.collection("professionals").document(prof_uid) \
        .collection("patients").where("email", "==", user.get("email", "")).limit(1).stream()
    patient_doc = next(patient_docs, None)
    patient_doc_id = patient_doc.id if patient_doc else None

    # Guardar el vínculo
    db.collection("patient_links").document(user["uid"]).set({
        "professional_uid": prof_uid,
        "patient_doc_id": patient_doc_id,
        "patient_email": user.get("email", ""),
        "linked_at": SERVER_TIMESTAMP
    })

    return {"professional_uid": prof_uid, "patient_doc_id": patient_doc_id}


@router.get("/my-link")
def get_my_link(user: dict = Depends(get_current_user)):
    """Paciente: obtiene su vínculo guardado (professional_uid, patient_doc_id)."""
    if user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Solo pacientes")
    db = get_firestore()
    doc = db.collection("patient_links").document(user["uid"]).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="No vinculado")
    return doc.to_dict()


@router.get("/resolve-code/{code}")
def resolve_code(code: str, user: dict = Depends(get_current_user)):
    """Paciente: resuelve un código de vinculación y devuelve el uid y nombre del profesional."""
    docs = get_firestore().collection("professionals") \
        .where("link_code", "==", code.upper().strip()).limit(1).stream()
    doc = next(docs, None)
    if doc is None:
        raise HTTPException(status_code=404, detail="Código inválido. Verificá con tu profesional.")

    data = doc.to_dict()
    prof_uid = doc.id

    # Obtener nombre del profesional desde Firebase Auth
    try:
        prof_profile = get_user(prof_uid)
        display_name = prof_profile.get("display_name") or prof_profile.get("email", "")
    except Exception:
        display_name = ""

    return {
        "professional_uid": prof_uid,
        "display_name": display_name
    }
