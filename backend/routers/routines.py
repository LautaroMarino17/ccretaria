from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from dependencies import get_current_user, require_professional
from services.firebase_service import get_firestore, get_user, get_all_patient_links
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class Exercise(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    enlace: Optional[str] = ""
    reps_seg_mts: Optional[str] = ""
    carga: Optional[str] = ""


class Circuit(BaseModel):
    nombre: str
    rondas: Optional[str] = ""
    ejercicios: List[Exercise] = []


class RoutineCreate(BaseModel):
    patient_id: str
    titulo: str
    descripcion: Optional[str] = ""
    circuitos: List[Circuit] = []
    observaciones: Optional[str] = ""


class RoutineUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    circuitos: Optional[List[Circuit]] = None
    observaciones: Optional[str] = None


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
        links = get_all_patient_links(db, user["uid"])
        if not links:
            return []
        results = []
        prof_names: dict = {}
        for link in links:
            prof_uid = link["prof_uid"]
            patient_doc_id = link["patient_doc_id"]
            if not prof_uid or not patient_doc_id:
                continue
            docs = db.collection("professionals").document(prof_uid) \
                .collection("patients").document(patient_doc_id) \
                .collection("routines").stream()
            for d in docs:
                r = {"id": d.id, **d.to_dict()}
                uid = r.get("professional_uid", "") or prof_uid
                if uid not in prof_names:
                    try:
                        prof_names[uid] = get_user(uid).get("display_name") or ""
                    except Exception:
                        prof_names[uid] = ""
                r["professional_name"] = prof_names.get(uid, "")
                results.append(r)
        results.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
        return results

    raise HTTPException(status_code=403, detail="Sin permisos")


@router.post("/")
def create_routine(body: RoutineCreate, user: dict = Depends(get_current_user)):
    """Crea una rutina para un paciente."""
    require_professional(user)
    db = get_firestore()

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


@router.post("/{routine_id}/patient/{patient_id}/share-email")
def share_routine_by_email(
    routine_id: str,
    patient_id: str,
    user: dict = Depends(get_current_user)
):
    """Profesional: envía la rutina por email al paciente."""
    require_professional(user)
    db = get_firestore()

    patient_ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id).get()
    if not patient_ref.exists:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    patient_data = patient_ref.to_dict()
    patient_email = patient_data.get("email", "")
    if not patient_email:
        raise HTTPException(status_code=422, detail="El paciente no tiene email registrado")

    routine_ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(patient_id) \
        .collection("routines").document(routine_id).get()
    if not routine_ref.exists:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    routine = routine_ref.to_dict()

    try:
        prof_profile = get_user(user["uid"])
        prof_name = prof_profile.get("display_name") or prof_profile.get("email", "el profesional")
    except Exception:
        prof_name = "el profesional"

    patient_name = f"{patient_data.get('nombre', '')} {patient_data.get('apellido', '')}".strip()

    # Construir HTML de la rutina
    circuits_html = ""
    for circ in routine.get("circuitos", []):
        rondas = circ.get("rondas", "")
        rondas_text = f" · {rondas} rondas" if rondas else ""
        exercises_html = "".join(
            f"<li><strong>{ex.get('nombre', '')}</strong>"
            + (f" — {ex.get('reps_seg_mts', '')}" if ex.get('reps_seg_mts') else "")
            + (f" · {ex.get('carga', '')}" if ex.get('carga') else "")
            + (f"<br><small style='color:#6b7280'>{ex.get('descripcion', '')}</small>" if ex.get('descripcion') else "")
            + "</li>"
            for ex in circ.get("ejercicios", [])
        )
        circuits_html += f"""
        <div style="margin-bottom:16px">
          <p style="margin:0 0 6px;font-weight:700;color:#16a34a">{circ.get('nombre', 'Bloque')}{rondas_text}</p>
          <ul style="margin:0;padding-left:18px;color:#374151">{exercises_html}</ul>
        </div>"""

    obs = routine.get("observaciones", "")
    obs_html = f"<p><em>Observaciones: {obs}</em></p>" if obs else ""
    routine_html = f"<h3 style='margin:0 0 12px'>{routine.get('titulo', 'Rutina')}</h3>{circuits_html}{obs_html}"

    from services.email_service import send_routine_by_email
    ok = send_routine_by_email(patient_email, patient_name, prof_name, routine.get("titulo", "Rutina"), routine_html)
    if not ok:
        raise HTTPException(status_code=500, detail="Error al enviar el email")

    return {"message": "Rutina enviada por email"}


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
