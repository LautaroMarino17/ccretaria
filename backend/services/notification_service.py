"""
Agente de notificaciones de turnos.
Revisa los turnos próximos y envía recordatorios.
En producción se puede ejecutar como Cloud Function scheduler o APScheduler.
"""
from datetime import datetime, timedelta, timezone
from services.firebase_service import get_firestore


def get_upcoming_appointments(hours_ahead: int = 24) -> list[dict]:
    """Retorna los turnos que ocurren dentro de las próximas N horas."""
    db = get_firestore()
    now = datetime.now(timezone.utc)
    limit = now + timedelta(hours=hours_ahead)

    appointments_ref = db.collection_group("appointments")
    query = appointments_ref.where("datetime", ">=", now).where("datetime", "<=", limit)
    docs = query.stream()

    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)

    return results


def build_notification_payload(appointment: dict) -> dict:
    """Construye el payload de notificación para un turno."""
    dt: datetime = appointment.get("datetime")
    patient_name = appointment.get("patient_name", "Paciente")
    professional_name = appointment.get("professional_name", "el profesional")

    if isinstance(dt, datetime):
        formatted = dt.strftime("%d/%m/%Y a las %H:%M")
    else:
        formatted = str(dt)

    return {
        "title": "Recordatorio de turno",
        "body": f"Tenés un turno con {professional_name} el {formatted}",
        "patient_uid": appointment.get("patient_uid"),
        "appointment_id": appointment.get("id"),
    }


def check_and_notify(hours_ahead: int = 24) -> list[dict]:
    """
    Función principal del agente de notificaciones.
    Retorna la lista de notificaciones generadas.
    """
    appointments = get_upcoming_appointments(hours_ahead)
    notifications = []

    for appt in appointments:
        payload = build_notification_payload(appt)
        # Aquí se integraría Firebase Cloud Messaging (FCM)
        # Por ahora loguea y retorna para debugging
        print(f"[NOTIFICACIÓN] {payload['body']}")
        notifications.append(payload)

    return notifications
