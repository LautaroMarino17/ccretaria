"""
Agente de notificaciones de turnos.
Revisa los turnos próximos y envía recordatorios por email.
En producción se puede ejecutar como Cloud Function scheduler o APScheduler.
"""
from datetime import datetime, timedelta, timezone
from services.firebase_service import get_firestore, get_user
from services.email_service import send_appointment_reminder


def get_upcoming_appointments(hours_ahead: int = 24) -> list[dict]:
    """Retorna los turnos confirmados que ocurren dentro de las próximas N horas."""
    db = get_firestore()
    now = datetime.now(timezone.utc)
    limit = now + timedelta(hours=hours_ahead)

    appointments_ref = db.collection_group("appointments")
    query = (
        appointments_ref
        .where("appointment_datetime", ">=", now)
        .where("appointment_datetime", "<=", limit)
        .where("status", "==", "confirmed")
    )
    docs = query.stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)

    return results


def check_and_notify(hours_ahead: int = 24) -> list[dict]:
    """
    Función principal del agente de notificaciones.
    Envía recordatorios por email a los pacientes con turno próximo.
    Retorna la lista de notificaciones enviadas.
    """
    appointments = get_upcoming_appointments(hours_ahead)
    notifications = []

    for appt in appointments:
        patient_uid = appt.get("patient_uid")
        patient_name = appt.get("patient_name", "Paciente")
        prof_name = appt.get("professional_name", "el profesional")
        lugar = appt.get("lugar", "")

        dt = appt.get("appointment_datetime")
        formatted_dt = dt.strftime("%d/%m/%Y a las %H:%M") if isinstance(dt, datetime) else str(dt)

        email_sent = False
        if patient_uid:
            try:
                patient_profile = get_user(patient_uid)
                patient_email = patient_profile.get("email", "")
                if patient_email:
                    email_sent = send_appointment_reminder(
                        patient_email, patient_name, prof_name, formatted_dt, lugar
                    )
            except Exception as e:
                print(f"[NOTIFICACIÓN] Error obteniendo perfil de {patient_uid}: {e}")

        payload = {
            "appointment_id": appt.get("id"),
            "patient_name": patient_name,
            "formatted_dt": formatted_dt,
            "email_sent": email_sent,
        }
        print(f"[NOTIFICACIÓN] {patient_name} — {formatted_dt} | email_sent={email_sent}")
        notifications.append(payload)

    return notifications
