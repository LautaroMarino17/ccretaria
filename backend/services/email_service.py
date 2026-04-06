"""
Servicio de email usando Resend.
https://resend.com — free tier: 100 emails/día, 3000/mes.

Requiere:
  pip install resend
  Variable de entorno: RESEND_API_KEY
"""
import os
import resend
from datetime import datetime

resend.api_key = os.getenv("RESEND_API_KEY", "")

# Remitente verificado en Resend (dominio propio o el sandbox de Resend)
FROM_ADDRESS = os.getenv("EMAIL_FROM", "SecretarIA <onboarding@resend.dev>")


def _send(to: str, subject: str, html: str) -> bool:
    """Envía un email. Retorna True si tuvo éxito."""
    if not resend.api_key:
        print(f"[EMAIL] RESEND_API_KEY no configurada. Destinatario: {to} | Asunto: {subject}")
        return False
    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as e:
        print(f"[EMAIL] Error al enviar a {to}: {e}")
        return False


def send_appointment_cancelled(patient_email: str, patient_name: str, prof_name: str, formatted_dt: str) -> bool:
    """Notifica al paciente que su turno fue cancelado por el profesional."""
    subject = "Tu turno fue cancelado"
    html = f"""
    <div style="font-family: sans-serif; max-width: 520px; margin: auto;">
      <h2 style="color: #e53935;">Turno cancelado</h2>
      <p>Hola <strong>{patient_name}</strong>,</p>
      <p>Te informamos que tu turno del <strong>{formatted_dt}</strong>
         con <strong>{prof_name}</strong> fue cancelado.</p>
      <p>Ingresá a la app para reservar un nuevo horario.</p>
      <br>
      <p style="color: #888; font-size: 12px;">SecretarIA — gestión de salud</p>
    </div>
    """
    return _send(patient_email, subject, html)


def send_appointment_reminder(patient_email: str, patient_name: str, prof_name: str, formatted_dt: str, lugar: str = "") -> bool:
    """Recordatorio de turno próximo al paciente."""
    subject = "Recordatorio: tenés un turno mañana"
    lugar_line = f"<p>📍 Lugar: <strong>{lugar}</strong></p>" if lugar else ""
    html = f"""
    <div style="font-family: sans-serif; max-width: 520px; margin: auto;">
      <h2 style="color: #1976d2;">Recordatorio de turno</h2>
      <p>Hola <strong>{patient_name}</strong>,</p>
      <p>Te recordamos que tenés un turno con <strong>{prof_name}</strong>:</p>
      <p>📅 <strong>{formatted_dt}</strong></p>
      {lugar_line}
      <br>
      <p style="color: #888; font-size: 12px;">SecretarIA — gestión de salud</p>
    </div>
    """
    return _send(patient_email, subject, html)
