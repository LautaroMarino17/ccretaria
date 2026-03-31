from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from dependencies import get_current_user, require_professional
from services.firebase_service import get_firestore, get_user
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class Exercise(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    series: Optional[str] = ""
    repeticiones: Optional[str] = ""
    duracion: Optional[str] = ""
    frecuencia: Optional[str] = ""
    imagen_url: Optional[str] = ""


class RoutineCreate(BaseModel):
    patient_id: str
    titulo: str
    descripcion: Optional[str] = ""
    ejercicios: list[Exercise] = []
    observaciones: Optional[str] = ""


class RoutineUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    ejercicios: Optional[list[Exercise]] = None
    observaciones: Optional[str] = None


# ── Profesional: CRUD completo ────────────────────────────────────

@router.get("/patient/{patient_id}")
def list_routines(patient_id: str, user: dict = Depends(get_current_user)):
    """Lista todas las rutinas de un paciente."""
    role = user.get("role", "")
    db = get_firestore()

    if role == "professional":
        docs = db.collection("professionals").document(user["uid"]) \
            .collection("patients").document(patient_id).collection("routines").stream()
        results = [{"id": d.id, **d.to_dict()} for d in docs]
        results.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
        return results

    elif role == "patient":
        # Leer el vínculo guardado en patient_links/{uid}
        link_doc = db.collection("patient_links").document(user["uid"]).get()
        if not link_doc.exists:
            return []
        link = link_doc.to_dict()
        prof_uid = link.get("professional_uid")
        patient_doc_id = link.get("patient_doc_id")
        if not prof_uid or not patient_doc_id:
            return []
        docs = db.collection("professionals").document(prof_uid) \
            .collection("patients").document(patient_doc_id) \
            .collection("routines").stream()
        results = [{"id": d.id, **d.to_dict()} for d in docs]
        # Agregar nombre del profesional a cada rutina
        prof_names: dict = {}
        for r in results:
            uid = r.get("professional_uid", "")
            if uid and uid not in prof_names:
                try:
                    prof_names[uid] = get_user(uid).get("display_name") or ""
                except Exception:
                    prof_names[uid] = ""
            r["professional_name"] = prof_names.get(uid, "")
        results.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
        return results

    raise HTTPException(status_code=403, detail="Sin permisos")


@router.post("/")
def create_routine(body: RoutineCreate, user: dict = Depends(get_current_user)):
    """Crea una rutina de ejercicios para un paciente."""
    require_professional(user)
    db = get_firestore()

    # Verificar que el paciente existe
    patient_ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(body.patient_id).get()
    if not patient_ref.exists:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    data = body.model_dump()
    data["created_at"] = SERVER_TIMESTAMP
    data["updated_at"] = SERVER_TIMESTAMP
    data["professional_uid"] = user["uid"]

    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(body.patient_id).collection("routines")
    doc = ref.add(data)

    return {"id": doc[1].id, "message": "Rutina creada correctamente"}


@router.put("/{routine_id}/patient/{patient_id}")
def update_routine(
    routine_id: str,
    patient_id: str,
    body: RoutineUpdate,
    user: dict = Depends(get_current_user)
):
    """Edita una rutina existente."""
    require_professional(user)
    db = get_firestore()

    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id) \
        .collection("routines").document(routine_id)

    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = SERVER_TIMESTAMP
    ref.update(updates)

    return {"message": "Rutina actualizada correctamente"}


@router.delete("/{routine_id}/patient/{patient_id}")
def delete_routine(
    routine_id: str,
    patient_id: str,
    user: dict = Depends(get_current_user)
):
    """Elimina una rutina."""
    require_professional(user)
    db = get_firestore()

    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id) \
        .collection("routines").document(routine_id)

    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    ref.delete()
    return {"message": "Rutina eliminada correctamente"}
