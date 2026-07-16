from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from dependencies import get_current_user, require_professional
from services.firebase_service import get_firestore, get_user, get_all_patient_links
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class EvaluationCreate(BaseModel):
    patient_id: Optional[str] = ""
    patient_name: Optional[str] = ""
    nombre: str
    fecha: str
    medidas: Optional[List[Any]] = []
    observaciones: Optional[str] = ""
    imagenes: Optional[List[Any]] = []


class EvaluationUpdate(BaseModel):
    model_config = ConfigDict(extra='ignore')
    nombre: Optional[Any] = None
    fecha: Optional[Any] = None
    medidas: Optional[List[Any]] = None
    observaciones: Optional[Any] = None
    imagenes: Optional[List[Any]] = None
    patient_name: Optional[Any] = None


@router.get("/")
def list_all_evaluations(user: dict = Depends(get_current_user)):
    """Profesional: lista todas las evaluaciones de todos sus pacientes."""
    require_professional(user)
    db = get_firestore()
    results = []
    for patient_doc in db.collection("professionals").document(user["uid"]).collection("patients").stream():
        patient_data = patient_doc.to_dict()
        patient_id = patient_doc.id
        for ev in patient_doc.reference.collection("evaluations").stream():
            ev_data = ev.to_dict()
            ev_data["id"] = ev.id
            ev_data["patient_id"] = patient_id
            if not ev_data.get("patient_name"):
                nombre = patient_data.get("nombre", "")
                apellido = patient_data.get("apellido", "")
                if nombre or apellido:
                    ev_data["patient_name"] = f"{apellido}, {nombre}".strip(", ")
            results.append(ev_data)
    results.sort(key=lambda x: x.get("fecha", ""), reverse=True)
    return results


@router.get("/patient/{patient_id}")
def list_evaluations(patient_id: str, user: dict = Depends(get_current_user)):
    """Lista las evaluaciones de un paciente. Accesible por profesional y paciente."""
    db = get_firestore()
    role = user.get("role", "")

    if role == "professional":
        professional_uid = user["uid"]
        patient_doc_id = patient_id
    elif role == "patient":
        links = get_all_patient_links(db, user["uid"])
        if not links:
            return []
        results = []
        for link in links:
            professional_uid = link["prof_uid"]
            patient_doc_id = link["patient_doc_id"]
            if not professional_uid or not patient_doc_id:
                continue
            docs = db.collection("professionals").document(professional_uid) \
                .collection("patients").document(patient_doc_id) \
                .collection("evaluations").stream()
            results.extend([{"id": d.id, **d.to_dict()} for d in docs])
        results.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
        return results
    else:
        raise HTTPException(status_code=403, detail="Sin permisos")

    docs = db.collection("professionals").document(professional_uid) \
        .collection("patients").document(patient_doc_id) \
        .collection("evaluations").stream()

    results = [{"id": d.id, **d.to_dict()} for d in docs]

    # Agregar nombre del profesional
    prof_names: dict = {}
    for r in results:
        uid = r.get("professional_uid", "")
        if uid and uid not in prof_names:
            try:
                prof_names[uid] = get_user(uid).get("display_name") or ""
            except Exception:
                prof_names[uid] = ""
        r["professional_name"] = prof_names.get(uid, "")

    results.sort(key=lambda x: x.get("fecha", ""), reverse=True)
    return results


@router.post("/")
def create_evaluation(body: EvaluationCreate, user: dict = Depends(get_current_user)):
    """Profesional: crea una evaluación/testeo para un paciente."""
    require_professional(user)
    db = get_firestore()

    data = body.model_dump()
    patient_id = data.pop("patient_id") or "_guest"
    data["professional_uid"] = user["uid"]
    data["created_at"] = SERVER_TIMESTAMP

    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id) \
        .collection("evaluations")
    doc = ref.add(data)
    return {"id": doc[1].id, "message": "Evaluación creada correctamente"}


@router.patch("/{eval_id}/patient/{patient_id}")
def update_evaluation(
    eval_id: str,
    patient_id: str,
    body: EvaluationUpdate,
    user: dict = Depends(get_current_user)
):
    """Profesional: edita una evaluación."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id) \
        .collection("evaluations").document(eval_id)

    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    raw = body.model_dump()
    updates = {}
    for k, v in raw.items():
        if v is None:
            continue
        if k in ("nombre", "fecha", "observaciones", "patient_name") and not isinstance(v, str):
            v = str(v)
        if k == "imagenes" and isinstance(v, list):
            v = [str(i) for i in v if i is not None]
        updates[k] = v

    if body.medidas is not None:
        updates["medidas"] = [m if isinstance(m, dict) else vars(m) for m in body.medidas]

    if not updates:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    print(f"[EvalUpdate] Saving fields: {list(updates.keys())}")
    ref.update(updates)
    return {"message": "Evaluación actualizada"}


@router.delete("/{eval_id}/patient/{patient_id}")
def delete_evaluation(eval_id: str, patient_id: str, user: dict = Depends(get_current_user)):
    """Profesional: elimina una evaluación."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id) \
        .collection("evaluations").document(eval_id)

    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    ref.delete()
    return {"message": "Evaluación eliminada"}
