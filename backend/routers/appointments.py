from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from dependencies import get_current_user, require_professional
from services.firebase_service import get_firestore, get_user, get_all_patient_links
from services.notification_service import check_and_notify
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class AvailableSlotCreate(BaseModel):
    datetime_iso: str   # "2026-04-15T10:00:00"
    duration_minutes: int = 30
    notes: Optional[str] = ""
    lugar: Optional[str] = ""


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

    dt_naive = dt.replace(tzinfo=None) if dt.tzinfo else dt
    if dt_naive < datetime.utcnow():
        raise HTTPException(status_code=400, detail="No se pueden crear horarios en fechas pasadas")

    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]).collection("available_slots")

    # Validar que no exista ya un slot en ese mismo horario
    existing = ref.where("datetime", "==", dt_naive).limit(1).stream()
    if next(existing, None):
        raise HTTPException(status_code=409, detail="Ya existe un horario en esa fecha y hora")

    data = {
        "datetime": dt_naive,
        "duration_minutes": body.duration_minutes,
        "notes": body.notes,
        "lugar": body.lugar,
        "booked": False,
        "professional_uid": user["uid"],
        "created_at": SERVER_TIMESTAMP,
    }
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
        results = []
        for d in ref.order_by("appointment_datetime").stream():
            appt = {"id": d.id, **d.to_dict()}
            # Si el paciente está registrado en la app, usar su nombre real
            patient_uid = appt.get("patient_uid")
            if patient_uid:
                try:
                    auth_profile = get_user(patient_uid)
                    auth_name = auth_profile.get("display_name", "")
                    if auth_name:
                        appt["patient_name"] = auth_name
                except Exception:
                    pass
            results.append(appt)
        return results

    elif role == "patient":
        docs = db.collection_group("appointments") \
            .where("patient_uid", "==", user["uid"]).stream()
        return [{"id": d.id, **d.to_dict()} for d in docs]

    raise HTTPException(status_code=403, detail="Sin permisos")


# ── PACIENTE: ve disponibilidad y agenda ─────────────────────────

@router.get("/day")
def list_day_appointments(date: str, user: dict = Depends(get_current_user)):
    """Profesional: retorna los turnos de un día dado."""
    require_professional(user)
    db = get_firestore()
    try:
        day_start = datetime.fromisoformat(date)
        day_end = day_start + timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato inválido (use YYYY-MM-DD)")

    ref = db.collection("professionals").document(user["uid"]).collection("appointments")
    docs = list(ref.where("appointment_datetime", ">=", day_start)
                   .where("appointment_datetime", "<", day_end).stream())

    results = []
    for d in docs:
        data = d.to_dict()
        if data.get("status") == "cancelled":
            continue
        dt = data.get("appointment_datetime")
        results.append({
            "id": d.id,
            "patient_name": data.get("patient_name", ""),
            "patient_doc_id": data.get("patient_doc_id", ""),
            "appointment_datetime": dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
            "status": data.get("status", "confirmed"),
            "lugar": data.get("lugar", ""),
            "notes": data.get("notes", ""),
            "tipo": data.get("tipo", "consulta"),
        })

    results.sort(key=lambda x: x.get("appointment_datetime") or "")
    return results


@router.delete("/{appointment_id}")
def delete_appointment(appointment_id: str, user: dict = Depends(get_current_user)):
    """Profesional: elimina un turno asignado."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("appointments").document(appointment_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    # Eliminar slot asociado si existe
    slot_id = doc.to_dict().get("slot_id")
    if slot_id:
        slot_ref = db.collection("professionals").document(user["uid"]) \
            .collection("available_slots").document(slot_id)
        if slot_ref.get().exists:
            slot_ref.delete()
    ref.delete()
    return {"message": "Turno eliminado"}


@router.get("/available/{professional_uid}")
def list_available_slots(professional_uid: str, user: dict = Depends(get_current_user)):
    """Paciente: consulta los horarios disponibles de su profesional (solo futuros)."""
    db = get_firestore()
    now = datetime.utcnow()
    ref = db.collection("professionals").document(professional_uid).collection("available_slots")
    docs = ref.where("booked", "==", False).where("datetime", ">=", now).stream()
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

    # Validar que el paciente no tenga otro turno activo y no vencido con este profesional
    # (tanto por patient_uid como por patient_doc_id si está vinculado)
    now = datetime.utcnow()

    def _check_active_appointment(appts_stream):
        for ea in appts_stream:
            ea_data = ea.to_dict()
            if ea_data.get("status") in ("pending_confirmation", "confirmed"):
                ea_dt = ea_data.get("appointment_datetime")
                if ea_dt:
                    ea_dt_naive = ea_dt.replace(tzinfo=None) if hasattr(ea_dt, "tzinfo") and ea_dt.tzinfo else ea_dt
                    if ea_dt_naive > now:
                        local_dt = ea_dt_naive - timedelta(hours=3)
                        raise HTTPException(
                            status_code=409,
                            detail=f"Ya tenés un turno activo el {local_dt.strftime('%d/%m/%Y a las %H:%M')}. Cancelalo antes de reservar otro."
                        )

    _check_active_appointment(
        db.collection("professionals").document(body.professional_uid)
          .collection("appointments").where("patient_uid", "==", user["uid"]).stream()
    )
    # También verificar por patient_doc_id si el paciente está vinculado a este profesional
    prof_link_doc = db.collection("patient_links").document(user["uid"]) \
        .collection("professionals").document(body.professional_uid).get()
    if prof_link_doc.exists:
        patient_doc_id = prof_link_doc.to_dict().get("patient_doc_id")
        if patient_doc_id:
            _check_active_appointment(
                db.collection("professionals").document(body.professional_uid)
                  .collection("appointments").where("patient_doc_id", "==", patient_doc_id).stream()
            )

    # Obtener nombre del profesional desde Firebase Auth
    try:
        prof_profile = get_user(body.professional_uid)
        prof_name = prof_profile.get("display_name") or prof_profile.get("email", "")
    except Exception:
        prof_doc = db.collection("professionals").document(body.professional_uid).get()
        prof_name = prof_doc.to_dict().get("display_name", "") if prof_doc.exists else ""

    # Obtener nombre del paciente desde el doc del profesional (tiene precedencia sobre Firebase Auth)
    patient_name = user.get("name", user.get("email", ""))
    if prof_link_doc.exists:
        patient_doc_id = prof_link_doc.to_dict().get("patient_doc_id")
        if patient_doc_id:
            p_doc = db.collection("professionals").document(body.professional_uid) \
                .collection("patients").document(patient_doc_id).get()
            if p_doc.exists:
                p = p_doc.to_dict()
                nombre = p.get("nombre", "")
                apellido = p.get("apellido", "")
                if nombre or apellido:
                    patient_name = f"{nombre} {apellido}".strip()

    # Crear el turno
    appointment_data = {
        "patient_uid": user["uid"],
        "patient_name": patient_name,
        "professional_uid": body.professional_uid,
        "professional_name": prof_name,
        "appointment_datetime": slot_data["datetime"],
        "duration_minutes": slot_data["duration_minutes"],
        "notes": body.notes,
        "lugar": slot_data.get("lugar", ""),
        "status": "pending_confirmation",
        "slot_id": body.slot_id,
        "created_at": SERVER_TIMESTAMP,
    }

    appt_ref = db.collection("professionals").document(body.professional_uid) \
        .collection("appointments")
    doc = appt_ref.add(appointment_data)

    # Marcar el slot como reservado
    slot_ref.update({"booked": True, "appointment_id": doc[1].id})

    return {"id": doc[1].id, "message": "Turno reservado correctamente"}


@router.get("/slots-day/{professional_uid}")
def list_day_slots(professional_uid: str, date: str, user: dict = Depends(get_current_user)):
    """
    Retorna todos los slots de un profesional para un día dado.
    Para pacientes: muestra status (available/occupied/mine) sin nombres ajenos.
    Para profesionales: muestra nombres de pacientes.
    date formato: YYYY-MM-DD
    """
    db = get_firestore()
    try:
        day_start = datetime.fromisoformat(date)
        day_end = day_start + timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (use YYYY-MM-DD)")

    ref = db.collection("professionals").document(professional_uid).collection("available_slots")
    docs = list(ref.where("datetime", ">=", day_start).where("datetime", "<", day_end).stream())

    role = user.get("role", "")

    # Para pacientes: obtener sus slot_ids reservados
    my_slot_ids: set = set()
    my_appt_status: dict = {}
    if role == "patient":
        my_appts = db.collection_group("appointments").where("patient_uid", "==", user["uid"]).stream()
        for a in my_appts:
            data = a.to_dict()
            sid = data.get("slot_id")
            if sid:
                my_slot_ids.add(sid)
                my_appt_status[sid] = data.get("status", "")

    results = []
    for d in docs:
        data = d.to_dict()
        slot = {
            "id": d.id,
            "datetime": data.get("datetime"),
            "duration_minutes": data.get("duration_minutes", 30),
            "lugar": data.get("lugar", ""),
            "notes": data.get("notes", ""),
            "booked": data.get("booked", False),
        }
        if role == "professional":
            slot["appointment_id"] = data.get("appointment_id", "")
            if data.get("booked") and data.get("appointment_id"):
                appt_doc = db.collection("professionals").document(professional_uid) \
                    .collection("appointments").document(data["appointment_id"]).get()
                if appt_doc.exists:
                    appt_data = appt_doc.to_dict()
                    patient_uid = appt_data.get("patient_uid")
                    # Si el paciente está registrado en la app, usar su nombre real
                    display_name = appt_data.get("patient_name", "")
                    if patient_uid:
                        try:
                            auth_profile = get_user(patient_uid)
                            auth_name = auth_profile.get("display_name", "")
                            if auth_name:
                                display_name = auth_name
                        except Exception:
                            pass
                    slot["patient_name"] = display_name
                    slot["patient_uid"] = patient_uid
                    slot["appointment_status"] = appt_data.get("status", "")
        else:
            if d.id in my_slot_ids:
                slot["status"] = "mine"
                slot["appointment_status"] = my_appt_status.get(d.id, "")
            elif data.get("booked"):
                slot["status"] = "occupied"
            else:
                slot["status"] = "available"
        results.append(slot)

    results.sort(key=lambda x: x.get("datetime") or "")
    return results


@router.post("/{appointment_id}/confirm")
def confirm_appointment(appointment_id: str, user: dict = Depends(get_current_user)):
    """Profesional: confirma una solicitud de turno pendiente."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("appointments").document(appointment_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    if doc.to_dict().get("status") != "pending_confirmation":
        raise HTTPException(status_code=409, detail="El turno no está pendiente de confirmación")
    ref.update({"status": "confirmed"})
    return {"message": "Turno confirmado"}


@router.post("/{appointment_id}/reject")
def reject_appointment(appointment_id: str, user: dict = Depends(get_current_user)):
    """Profesional: rechaza una solicitud de turno pendiente y libera el slot."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("appointments").document(appointment_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    appt_data = doc.to_dict()
    ref.update({"status": "cancelled"})
    # Liberar slot
    slot_id = appt_data.get("slot_id")
    if slot_id:
        db.collection("professionals").document(user["uid"]) \
            .collection("available_slots").document(slot_id) \
            .update({"booked": False, "appointment_id": None})
    return {"message": "Turno rechazado"}


@router.patch("/{appointment_id}/cancel")
def cancel_appointment(appointment_id: str, user: dict = Depends(get_current_user)):
    """Paciente o profesional: cancela un turno y libera el slot."""
    db = get_firestore()
    role = user.get("role", "")

    if role == "professional":
        appt_ref = db.collection("professionals").document(user["uid"]) \
            .collection("appointments").document(appointment_id)
    elif role == "patient":
        # Buscar por patient_uid (turno reservado por el paciente)
        docs = db.collection_group("appointments") \
            .where("patient_uid", "==", user["uid"]).stream()
        appt_ref = next((d.reference for d in docs if d.id == appointment_id), None)

        # Si no encontró, buscar via patient_links (turno asignado por el profesional)
        if appt_ref is None:
            for lnk in get_all_patient_links(db, user["uid"]):
                prof_uid_link = lnk["prof_uid"]
                patient_doc_id_link = lnk["patient_doc_id"]
                if not prof_uid_link or not patient_doc_id_link:
                    continue
                candidate = db.collection("professionals").document(prof_uid_link) \
                    .collection("appointments").document(appointment_id).get()
                if candidate.exists and candidate.to_dict().get("patient_doc_id") == patient_doc_id_link:
                    appt_ref = candidate.reference
                    break

        if appt_ref is None:
            raise HTTPException(status_code=404, detail="Turno no encontrado")
    else:
        raise HTTPException(status_code=403, detail="Sin permisos")

    appt_doc = appt_ref.get()
    if not appt_doc.exists:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    appt_data = appt_doc.to_dict()

    slot_id = appt_data.get("slot_id")
    prof_uid = appt_data.get("professional_uid")
    if slot_id and prof_uid:
        slot_ref = db.collection("professionals").document(prof_uid) \
            .collection("available_slots").document(slot_id)
        slot_doc = slot_ref.get()
        if slot_doc.exists and slot_doc.to_dict().get("assigned_by_professional"):
            # Slot creado por el profesional: eliminar completamente
            slot_ref.delete()
        else:
            # Slot creado para disponibilidad: volver a disponible
            slot_ref.update({"booked": False, "appointment_id": None})

    if role == "patient":
        # El paciente cancela: eliminar el turno para que vuelva a aparecer como disponible
        appt_ref.delete()
    else:
        appt_ref.update({"status": "cancelled"})

    return {"message": "Turno cancelado"}


@router.post("/{appointment_id}/cancel-by-professional")
def cancel_by_professional(appointment_id: str, user: dict = Depends(get_current_user)):
    """Profesional: cancela un turno confirmado/pendiente y notifica al paciente por email."""
    require_professional(user)
    db = get_firestore()
    ref = db.collection("professionals").document(user["uid"]) \
        .collection("appointments").document(appointment_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Turno no encontrado")

    appt_data = doc.to_dict()
    ref.update({"status": "cancelled"})

    slot_id = appt_data.get("slot_id")
    if slot_id:
        slot_ref = db.collection("professionals").document(user["uid"]) \
            .collection("available_slots").document(slot_id)
        if slot_ref.get().exists:
            slot_ref.delete()  # siempre eliminar: el médico deja el día sin horario

    # Notificación al paciente (email)
    patient_uid = appt_data.get("patient_uid")
    patient_name = appt_data.get("patient_name", "Paciente")
    try:
        prof_profile = get_user(user["uid"])
        prof_name = prof_profile.get("display_name") or "el profesional"
    except Exception:
        prof_name = "el profesional"

    dt = appt_data.get("appointment_datetime")
    formatted_dt = dt.strftime("%d/%m/%Y a las %H:%M") if isinstance(dt, datetime) else str(dt)

    if patient_uid:
        try:
            patient_profile = get_user(patient_uid)
            patient_email = patient_profile.get("email", "")
            if patient_email:
                from services.email_service import send_appointment_cancelled
                send_appointment_cancelled(patient_email, patient_name, prof_name, formatted_dt)
        except Exception:
            pass

    return {"message": "Turno cancelado y paciente notificado"}


@router.post("/notify")
def trigger_notifications(user: dict = Depends(get_current_user)):
    """Dispara el agente de notificaciones manualmente."""
    require_professional(user)
    notifications = check_and_notify(hours_ahead=24)
    return {"notifications_sent": len(notifications), "details": notifications}


@router.post("/notify-push")
def send_daily_push(user: dict = Depends(get_current_user)):
    """Envía la agenda del día como push notification al profesional."""
    require_professional(user)
    db = get_firestore()

    today = datetime.now()
    day_start = datetime(today.year, today.month, today.day)
    day_end   = day_start + timedelta(days=1)

    ref  = db.collection("professionals").document(user["uid"]).collection("appointments")
    docs = list(ref.where("appointment_datetime", ">=", day_start)
                   .where("appointment_datetime", "<",  day_end).stream())

    appts = []
    for d in docs:
        data = d.to_dict()
        if data.get("status") == "cancelled":
            continue
        dt = data.get("appointment_datetime")
        appts.append({
            "time": dt.strftime("%H:%M") if isinstance(dt, datetime) else "--:--",
            "name": data.get("patient_name", "Paciente")
        })
    appts.sort(key=lambda x: x["time"])

    count = len(appts)
    if count == 0:
        title = "Sin turnos hoy"
        body  = "No tenés turnos programados para hoy."
    else:
        title = f"Agenda de hoy — {count} turno{'s' if count != 1 else ''}"
        lines = [f"{a['time']} — {a['name']}" for a in appts[:5]]
        if count > 5:
            lines.append(f"+{count - 5} más...")
        body = "\n".join(lines)

    prof_doc = db.collection("professionals").document(user["uid"]).get()
    tokens   = (prof_doc.to_dict() or {}).get("fcm_tokens", []) if prof_doc.exists else []

    import firebase_admin
    import firebase_admin.messaging as fcm_msg
    from google.cloud.firestore_v1 import ArrayRemove

    sent   = 0
    failed = []
    for token in tokens:
        try:
            fcm_msg_obj = fcm_msg.Message(
                notification=fcm_msg.Notification(title=title, body=body),
                android=fcm_msg.AndroidConfig(priority="high"),
                apns=fcm_msg.APNSConfig(
                    payload=fcm_msg.APNSPayload(aps=fcm_msg.Aps(sound="default"))
                ),
                token=token
            )
            firebase_admin.messaging.send(fcm_msg_obj)
            sent += 1
        except Exception:
            failed.append(token)

    if failed:
        db.collection("professionals").document(user["uid"]).update(
            {"fcm_tokens": ArrayRemove(failed)}
        )

    return {"sent": sent, "appointments": count}


class AssignAppointmentBody(BaseModel):
    patient_id: str
    patient_name: str
    datetime_iso: str
    duration_minutes: int = 60
    notes: Optional[str] = ""
    lugar: Optional[str] = ""
    tipo: Optional[str] = "consulta"


@router.post("/assign")
def assign_appointment(body: AssignAppointmentBody, user: dict = Depends(get_current_user)):
    """Profesional: asigna un turno directamente a un paciente. Permite múltiples pacientes por horario."""
    require_professional(user)
    try:
        dt = datetime.fromisoformat(body.datetime_iso)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    dt_naive = dt.replace(tzinfo=None) if dt.tzinfo else dt
    if dt_naive < datetime.utcnow():
        raise HTTPException(status_code=400, detail="No se pueden asignar turnos en fechas pasadas")

    db = get_firestore()

    # Verificar que el paciente existe
    patient_ref = db.collection("professionals").document(user["uid"]) \
        .collection("patients").document(body.patient_id).get()
    if not patient_ref.exists:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    # Verificar que el paciente no tenga ya un turno este mismo día
    day_start = dt_naive.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)
    all_patient_appts = list(
        db.collection("professionals").document(user["uid"])
          .collection("appointments")
          .where("patient_doc_id", "==", body.patient_id)
          .stream()
    )
    for a in all_patient_appts:
        data = a.to_dict()
        if data.get("status") == "cancelled":
            continue
        ea_dt = data.get("appointment_datetime")
        if ea_dt:
            ea_dt_n = ea_dt.replace(tzinfo=None) if hasattr(ea_dt, "tzinfo") and ea_dt.tzinfo else ea_dt
            if day_start <= ea_dt_n < day_end:
                raise HTTPException(status_code=409, detail="Este paciente ya tiene un turno asignado para este día")

    try:
        prof_profile = get_user(user["uid"])
        prof_name = prof_profile.get("display_name") or prof_profile.get("email", "")
    except Exception:
        prof_name = ""

    appointment_data = {
        "patient_name": body.patient_name,
        "patient_doc_id": body.patient_id,
        "professional_uid": user["uid"],
        "professional_name": prof_name,
        "appointment_datetime": dt_naive,
        "duration_minutes": 60,
        "notes": body.notes,
        "lugar": body.lugar,
        "tipo": body.tipo or "consulta",
        "status": "confirmed",
        "assigned_by_professional": True,
        "created_at": SERVER_TIMESTAMP,
    }

    appt_ref = db.collection("professionals").document(user["uid"]).collection("appointments")
    doc = appt_ref.add(appointment_data)

    # Notificar al paciente por email si tiene correo registrado
    try:
        patient_doc = db.collection("professionals").document(user["uid"]) \
            .collection("patients").document(body.patient_id).get()
        if patient_doc.exists:
            patient_email = patient_doc.to_dict().get("email", "")
            if patient_email:
                local_dt = dt_naive - timedelta(hours=3)
                formatted_dt = local_dt.strftime("%d/%m/%Y a las %H:%M")
                lugar = body.lugar or ""
                from services.email_service import send_appointment_assigned
                send_appointment_assigned(patient_email, body.patient_name, prof_name, formatted_dt, lugar)
    except Exception:
        pass

    return {"id": doc[1].id, "message": "Turno asignado correctamente"}
