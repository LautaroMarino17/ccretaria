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


def _register_patient(db, prof_uid: str, patient_doc_id: str, dni: str, email: str = ""):
    """Registra/actualiza la entrada del paciente en el registry global usando DNI como clave."""
    if not dni:
        return
    reg_ref = db.collection("patient_registry").document(dni.strip())
    reg_doc = reg_ref.get()
    if reg_doc.exists:
        data = reg_doc.to_dict()
        professionals = data.get("professionals", [])
        if not any(p["prof_uid"] == prof_uid for p in professionals):
            professionals.append({"prof_uid": prof_uid, "patient_doc_id": patient_doc_id})
            updates = {"professionals": professionals}
            if email:
                updates["email"] = email.strip().lower()
            reg_ref.update(updates)
    else:
        reg_ref.set({
            "dni": dni.strip(),
            "email": email.strip().lower() if email else "",
            "professionals": [{"prof_uid": prof_uid, "patient_doc_id": patient_doc_id}],
            "created_at": SERVER_TIMESTAMP
        })


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
    """Crea un nuevo paciente asociado al profesional.
    - Si el email ya existe en este profesional → devuelve el doc existente.
    - Si el email ya existe en el registry global → crea un doc en este profesional
      usando los datos que el médico ingresó, y registra la asociación.
    - Si el DNI ya existe en este profesional → error.
    """
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]).collection("patients")

    # Si tiene email, verificar si ya existe en ESTE profesional
    if body.email:
        email_key = _registry_key(body.email)
        existing_email = ref.where("email", "==", email_key).limit(1).stream()
        existing_doc = next(existing_email, None)
        if existing_doc:
            existing_data = existing_doc.to_dict()
            # Si el DNI no coincide, hay un conflicto de identidad
            if existing_data.get("dni") and existing_data.get("dni") != body.dni:
                raise HTTPException(
                    status_code=409,
                    detail=f"Ese email ya pertenece a un paciente con DNI {existing_data['dni']}. "
                           f"Verificá los datos o corregí el email."
                )
            return {"id": existing_doc.id, "message": "Paciente existente recuperado"}

    # Verificar DNI único por profesional
    existing_dni = ref.where("dni", "==", body.dni).limit(1).stream()
    existing_dni_doc = next(existing_dni, None)
    if existing_dni_doc:
        existing_data = existing_dni_doc.to_dict()
        # Si tiene email distinto, también es un conflicto
        if body.email and existing_data.get("email") and existing_data.get("email") != _registry_key(body.email):
            raise HTTPException(
                status_code=409,
                detail=f"Ese DNI ya pertenece a un paciente con email {existing_data['email']}. "
                       f"Verificá los datos o corregí el email."
            )
        raise HTTPException(status_code=409, detail="Ya existe un paciente con ese DNI")

    data = body.model_dump()
    if data.get("email"):
        data["email"] = _registry_key(data["email"])
    data["created_at"] = SERVER_TIMESTAMP
    data["professional_uid"] = user["uid"]

    doc = ref.add(data)
    patient_doc_id = doc[1].id

    # Registrar en el registry global por DNI
    try:
        _register_patient(db, user["uid"], patient_doc_id, body.dni, body.email or "")
    except Exception:
        pass

    return {"id": patient_doc_id, "message": "Paciente creado correctamente"}


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
    """Profesional: actualiza el teléfono o email del paciente."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    allowed = {k: v for k, v in body.items() if k in ("telefono", "email")}
    if not allowed:
        raise HTTPException(status_code=400, detail="Solo se puede editar teléfono o email")
    ref.update(allowed)
    return {"message": "Paciente actualizado"}


@router.delete("/{patient_id}")
def delete_patient(patient_id: str, user: dict = Depends(get_current_user)):
    """Profesional: elimina un paciente y todos sus datos."""
    require_professional(user)
    db = get_firestore()
    patient_ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id)
    patient_doc = patient_ref.get()
    if not patient_doc.exists:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    # Quitar del registry global por DNI
    try:
        dni = patient_doc.to_dict().get("dni", "")
        if dni:
            reg_ref = db.collection("patient_registry").document(dni.strip())
            reg_doc = reg_ref.get()
            if reg_doc.exists:
                professionals = [
                    p for p in reg_doc.to_dict().get("professionals", [])
                    if not (p["prof_uid"] == user["uid"] and p["patient_doc_id"] == patient_id)
                ]
                if professionals:
                    reg_ref.update({"professionals": professionals})
                else:
                    reg_ref.delete()
    except Exception:
        pass

    # Eliminar subcolecciones
    for subcol in ["routines", "clinical_histories", "evaluations"]:
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
