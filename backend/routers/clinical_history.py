from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from dependencies import get_current_user, require_professional
from services.firebase_service import get_firestore, get_user
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class SignosVitales(BaseModel):
    tension_arterial: Optional[str] = ""
    frecuencia_cardiaca: Optional[str] = ""
    temperatura: Optional[str] = ""
    peso: Optional[str] = ""
    talla: Optional[str] = ""
    saturacion: Optional[str] = ""


class ClinicalHistoryCreate(BaseModel):
    patient_id: str
    nombre_paciente: Optional[str] = ""
    motivo_consulta: Optional[str] = ""
    enfermedad_actual: Optional[str] = ""
    antecedentes_personales: Optional[str] = ""
    antecedentes_familiares: Optional[str] = ""
    examen_fisico: Optional[str] = ""
    signos_vitales: Optional[SignosVitales] = None
    diagnostico: Optional[str] = ""
    plan_terapeutico: Optional[str] = ""
    estudios_complementarios: Optional[str] = ""
    observaciones: Optional[str] = ""
    transcripcion_original: Optional[str] = ""
    verificada: bool = False
    imagen_url: Optional[str] = ""
    estudio_nombre: Optional[str] = ""
    estudio_url: Optional[str] = ""


class ClinicalHistoryUpdate(BaseModel):
    motivo_consulta: Optional[str] = None
    enfermedad_actual: Optional[str] = None
    antecedentes_personales: Optional[str] = None
    antecedentes_familiares: Optional[str] = None
    examen_fisico: Optional[str] = None
    signos_vitales: Optional[SignosVitales] = None
    diagnostico: Optional[str] = None
    plan_terapeutico: Optional[str] = None
    estudios_complementarios: Optional[str] = None
    observaciones: Optional[str] = None
    imagen_url: Optional[str] = None
    estudio_nombre: Optional[str] = None
    estudio_url: Optional[str] = None


@router.get("/")
def list_all_histories(user: dict = Depends(get_current_user)):
    """Profesional: lista todas las historias clínicas de todos sus pacientes."""
    require_professional(user)
    db = get_firestore()
    patients = db.collection("professionals").document(user["uid"]).collection("patients").stream()
    results = []
    for patient_doc in patients:
        patient_data = patient_doc.to_dict()
        patient_name = f"{patient_data.get('nombre', '')} {patient_data.get('apellido', '')}".strip()
        histories = patient_doc.reference.collection("clinical_histories").stream()
        for h in histories:
            results.append({"id": h.id, "patient_name": patient_name, "patient_id": patient_doc.id, **h.to_dict()})
    results.sort(key=lambda x: str(x.get("fecha") or ""), reverse=True)
    return results


@router.post("/")
def create_clinical_history(
    body: ClinicalHistoryCreate,
    user: dict = Depends(get_current_user)
):
    """Guarda una historia clínica verificada en Firestore."""
    require_professional(user)
    db = get_firestore()

    data = body.model_dump()
    data["fecha"] = SERVER_TIMESTAMP
    data["professional_uid"] = user["uid"]
    data["verificada"] = True

    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(body.patient_id).collection("clinical_histories")
    doc = ref.add(data)

    return {"id": doc[1].id, "message": "Historia clínica guardada correctamente"}


@router.get("/patient/{patient_id}")
def list_clinical_histories(
    patient_id: str,
    user: dict = Depends(get_current_user)
):
    """
    Lista las historias clínicas de un paciente.
    Accesible por el profesional (sus pacientes) y el propio paciente.
    """
    db = get_firestore()
    role = user.get("role", "")

    if role == "professional":
        professional_uid = user["uid"]
        patient_doc_id = patient_id
    elif role == "patient":
        link_doc = db.collection("patient_links").document(user["uid"]).get()
        if not link_doc.exists:
            raise HTTPException(status_code=404, detail="No estás vinculado a ningún profesional")
        link = link_doc.to_dict()
        professional_uid = link.get("professional_uid", "")
        patient_doc_id = link.get("patient_doc_id", "")
        if not professional_uid or not patient_doc_id:
            raise HTTPException(status_code=404, detail="Vínculo incompleto")
    else:
        raise HTTPException(status_code=403, detail="Sin permisos")

    docs = db.collection("professionals").document(professional_uid) \
        .collection("patients").document(patient_doc_id) \
        .collection("clinical_histories").stream()
    results = [{"id": d.id, **d.to_dict()} for d in docs]
    # Agregar nombre del profesional (cachear para no hacer múltiples llamadas)
    prof_names: dict = {}
    for r in results:
        uid = r.get("professional_uid", "")
        if uid and uid not in prof_names:
            try:
                prof_names[uid] = get_user(uid).get("display_name") or ""
            except Exception:
                prof_names[uid] = ""
        r["professional_name"] = prof_names.get(uid, "")
    results.sort(key=lambda x: str(x.get("fecha") or ""), reverse=True)
    return results


@router.delete("/{history_id}/patient/{patient_id}")
def delete_clinical_history(
    history_id: str,
    patient_id: str,
    user: dict = Depends(get_current_user)
):
    """Profesional: elimina una historia clínica."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id) \
        .collection("clinical_histories").document(history_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Historia clínica no encontrada")
    ref.delete()
    return {"message": "Historia clínica eliminada"}


@router.get("/{history_id}/patient/{patient_id}")
def get_clinical_history(
    history_id: str,
    patient_id: str,
    user: dict = Depends(get_current_user)
):
    """Obtiene una historia clínica específica."""
    require_professional(user)
    db = get_firestore()

    doc = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id) \
        .collection("clinical_histories").document(history_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Historia clínica no encontrada")

    return {"id": doc.id, **doc.to_dict()}


@router.patch("/{history_id}/patient/{patient_id}")
def update_clinical_history(
    history_id: str,
    patient_id: str,
    body: ClinicalHistoryUpdate,
    user: dict = Depends(get_current_user)
):
    """Profesional: edita una historia clínica existente."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id) \
        .collection("clinical_histories").document(history_id)

    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Historia clínica no encontrada")

    # Solo actualiza los campos que vienen con valor no-None
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if body.signos_vitales is not None:
        updates["signos_vitales"] = body.signos_vitales.model_dump()

    if not updates:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    ref.update(updates)
    return {"message": "Historia clínica actualizada"}
