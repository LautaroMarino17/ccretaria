from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from dependencies import get_current_user, require_professional
from services.firebase_service import get_firestore
from services.notification_service import check_and_notify
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class AvailableSlotCreate(BaseModel):
    datetime_iso: str   # "2026-04-15T10:00:00"
    duration_minutes: int = 30
    notes: Optional[str] = ""


class AppointmentBook(BaseModel):
    professional_uid: str
    slot_id: str
    notes: Optional[str] = ""


# ── PROFESIONAL: gestiona su disponibilidad y ve sus turnos ──────

@router.get("/slots")
def list_my_slots(user: dict = Depends(get_current_user)):
    """Profesional: lista sus horarios disponibles."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]).collection("available_slots")
    docs = ref.stream()
    results = [{"id": d.id, **d.to_dict()} for d in docs]
    results.sort(key=lambda x: x.get("datetime") or "")
    return results


@router.post("/slots")
def create_slot(body: AvailableSlotCreate, user: dict = Depends(get_current_user)):
    """Profesional: agrega un horario disponible."""
    require_professional(user)
    try:
        dt = datetime.fromisoformat(body.datetime_iso)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use ISO 8601")

    db = get_firestore()
    data = {
        "datetime": dt,
        "duration_minutes": body.duration_minutes,
        "notes": body.notes,
        "booked": False,
        "professional_uid": user["uid"],
        "created_at": SERVER_TIMESTAMP,
    }
    ref = db.collection("professionals").document(user["uid"]).collection("available_slots")
    doc = ref.add(data)
    return {"id": doc[1].id, "message": "Horario disponible creado"}


@router.delete("/slots/{slot_id}")
def delete_slot(slot_id: str, user: dict = Depends(get_current_user)):
    """Profesional: elimina un horario disponible (solo si no está reservado)."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("available_slots").document(slot_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    if doc.to_dict().get("booked"):
        raise HTTPException(status_code=409, detail="No se puede eliminar un horario ya reservado")
    ref.delete()
    return {"message": "Horario eliminado"}


@router.get("/")
def list_appointments(user: dict = Depends(get_current_user)):
    """
    Profesional: lista sus turnos reservados.
    Paciente: lista sus turnos.
    """
    db = get_firestore()
    role = user.get("role", "")

    if role == "professional":
        ref = db.collection("professionals").document(user["uid"]).collection("appointments")
        docs = ref.order_by("appointment_datetime").stream()
        return [{"id": d.id, **d.to_dict()} for d in docs]

    elif role == "patient":
        docs = db.collection_group("appointments") \
            .where("patient_uid", "==", user["uid"]).stream()
        return [{"id": d.id, **d.to_dict()} for d in docs]

    raise HTTPException(status_code=403, detail="Sin permisos")


# ── PACIENTE: ve disponibilidad y agenda ─────────────────────────

@router.get("/available/{professional_uid}")
def list_available_slots(professional_uid: str, user: dict = Depends(get_current_user)):
    """Paciente: consulta los horarios disponibles de su profesional."""
    db = get_firestore()
    ref = db.collection("professionals").document(professional_uid).collection("available_slots")
    docs = ref.where("booked", "==", False).stream()
    results = [{"id": d.id, **d.to_dict()} for d in docs]
    results.sort(key=lambda x: x.get("datetime") or "")
    return results


@router.post("/book")
def book_appointment(body: AppointmentBook, user: dict = Depends(get_current_user)):
    """Paciente: reserva un horario disponible."""
    if user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Solo pacientes pueden reservar turnos")

    db = get_firestore()

    # Verificar que el slot existe y no está reservado
    slot_ref = db.collection("professionals").document(body.professional_uid) \
        .collection("available_slots").document(body.slot_id)
    slot_doc = slot_ref.get()

    if not slot_doc.exists:
        raise HTTPException(status_code=404, detail="Horario no encontrado")
    slot_data = slot_doc.to_dict()
    if slot_data.get("booked"):
        raise HTTPException(status_code=409, detail="Este horario ya fue reservado")

    # Obtener info del profesional
    prof_doc = db.collection("professionals").document(body.professional_uid).get()
    prof_name = prof_doc.to_dict().get("display_name", "") if prof_doc.exists else ""

    # Crear el turno
    appointment_data = {
        "patient_uid": user["uid"],
        "patient_name": user.get("name", user.get("email", "")),
        "professional_uid": body.professional_uid,
        "professional_name": prof_name,
        "appointment_datetime": slot_data["datetime"],
        "duration_minutes": slot_data["duration_minutes"],
        "notes": body.notes,
        "status": "confirmed",
        "slot_id": body.slot_id,
        "created_at": SERVER_TIMESTAMP,
    }

    appt_ref = db.collection("professionals").document(body.professional_uid) \
        .collection("appointments")
    doc = appt_ref.add(appointment_data)

    # Marcar el slot como reservado
    slot_ref.update({"booked": True, "appointment_id": doc[1].id})

    return {"id": doc[1].id, "message": "Turno reservado correctamente"}


@router.patch("/{appointment_id}/cancel")
def cancel_appointment(appointment_id: str, user: dict = Depends(get_current_user)):
    """Paciente o profesional: cancela un turno y libera el slot."""
    db = get_firestore()
    role = user.get("role", "")

    if role == "professional":
        appt_ref = db.collection("professionals").document(user["uid"]) \
            .collection("appointments").document(appointment_id)
    elif role == "patient":
        docs = db.collection_group("appointments") \
            .where("patient_uid", "==", user["uid"]).stream()
        appt_ref = next((d.reference for d in docs if d.id == appointment_id), None)
        if appt_ref is None:
            raise HTTPException(status_code=404, detail="Turno no encontrado")
    else:
        raise HTTPException(status_code=403, detail="Sin permisos")

    appt_doc = appt_ref.get()
    if not appt_doc.exists:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    appt_data = appt_doc.to_dict()
    appt_ref.update({"status": "cancelled"})

    # Liberar el slot para que otro paciente pueda reservarlo
    slot_id = appt_data.get("slot_id")
    prof_uid = appt_data.get("professional_uid")
    if slot_id and prof_uid:
        db.collection("professionals").document(prof_uid) \
            .collection("available_slots").document(slot_id) \
            .update({"booked": False, "appointment_id": None})

    return {"message": "Turno cancelado"}


@router.post("/notify")
def trigger_notifications(user: dict = Depends(get_current_user)):
    """Dispara el agente de notificaciones manualmente."""
    require_professional(user)
    notifications = check_and_notify(hours_ahead=24)
    return {"notifications_sent": len(notifications), "details": notifications}
