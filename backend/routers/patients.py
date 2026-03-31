from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from dependencies import get_current_user, require_professional
from services.firebase_service import get_firestore
from services.llm_service import generate_routine
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class PatientCreate(BaseModel):
    nombre: str
    apellido: str
    dni: str
    fecha_nacimiento: str
    sexo: str
    telefono: Optional[str] = None
    email: Optional[str] = None
    obra_social: Optional[str] = None
    nro_afiliado: Optional[str] = None
    diagnostico_inicial: Optional[str] = None


class RoutineRequest(BaseModel):
    patient_id: str
    patient_info: dict


@router.get("/")
def list_patients(user: dict = Depends(get_current_user)):
    """Lista los pacientes del profesional autenticado."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]).collection("patients")
    docs = ref.order_by("apellido").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.post("/")
def create_patient(body: PatientCreate, user: dict = Depends(get_current_user)):
    """Crea un nuevo paciente asociado al profesional."""
    require_professional(user)
    db = get_firestore()

    # Verificar DNI único por profesional
    existing = db.collection("professionals").document(user["uid"]) \
        .collection("patients").where("dni", "==", body.dni).limit(1).stream()
    if any(True for _ in existing):
        raise HTTPException(status_code=409, detail="Ya existe un paciente con ese DNI")

    data = body.model_dump()
    data["created_at"] = SERVER_TIMESTAMP
    data["professional_uid"] = user["uid"]

    ref = db.collection("professionals").document(user["uid"]).collection("patients")
    doc = ref.add(data)
    return {"id": doc[1].id, "message": "Paciente creado correctamente"}


@router.get("/{patient_id}")
def get_patient(patient_id: str, user: dict = Depends(get_current_user)):
    """Obtiene los datos de un paciente específico."""
    require_professional(user)
    db = get_firestore()
    doc = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    return {"id": doc.id, **doc.to_dict()}


@router.patch("/{patient_id}")
def update_patient(patient_id: str, body: dict, user: dict = Depends(get_current_user)):
    """Profesional: actualiza el teléfono del paciente."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    allowed = {k: v for k, v in body.items() if k == "telefono"}
    if not allowed:
        raise HTTPException(status_code=400, detail="Solo se puede editar el teléfono")
    ref.update(allowed)
    return {"message": "Paciente actualizado"}


@router.delete("/{patient_id}")
def delete_patient(patient_id: str, user: dict = Depends(get_current_user)):
    """Profesional: elimina un paciente y todos sus datos."""
    require_professional(user)
    db = get_firestore()
    patient_ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id)
    if not patient_ref.get().exists:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    # Eliminar subcolecciones
    for subcol in ["routines", "clinical_histories"]:
        for doc in patient_ref.collection(subcol).stream():
            doc.reference.delete()
    patient_ref.delete()
    return {"message": "Paciente eliminado"}


@router.get("/{patient_id}/routine")
def get_patient_routine(patient_id: str, user: dict = Depends(get_current_user)):
    """Obtiene el plan de rutina del paciente (accesible por profesional y por el propio paciente)."""
    db = get_firestore()
    role = user.get("role", "")

    if role == "professional":
        doc = db.collection("professionals").document(user["uid"]) \
            .collection("patients").document(patient_id).get()
    elif role == "patient":
        # El paciente solo puede ver su propia rutina
        doc = db.collection_group("patients").where("patient_uid", "==", user["uid"]).limit(1).stream()
        doc = next(doc, None)
        if doc is None:
            raise HTTPException(status_code=404, detail="No se encontró tu perfil de paciente")
    else:
        raise HTTPException(status_code=403, detail="Sin permisos")

    routine_ref = db.collection("professionals").document(
        doc.to_dict().get("professional_uid", "")).collection("patients") \
        .document(patient_id).collection("routines").order_by("created_at", direction="DESCENDING").limit(1).stream()

    routines = [{"id": r.id, **r.to_dict()} for r in routine_ref]
    return routines[0] if routines else {}


@router.post("/{patient_id}/routine/generate")
def generate_patient_routine(
    patient_id: str,
    body: RoutineRequest,
    user: dict = Depends(get_current_user)
):
    """Genera un plan de rutina personalizado usando el LLM y lo guarda en Firestore."""
    require_professional(user)
    db = get_firestore()

    routine = generate_routine(body.patient_info)
    routine["created_at"] = SERVER_TIMESTAMP
    routine["professional_uid"] = user["uid"]
    routine["patient_id"] = patient_id

    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id).collection("routines")
    doc = ref.add(routine)

    return {"id": doc[1].id, "routine": routine}
