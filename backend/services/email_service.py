"""
Servicio de email usando Gmail SMTP.
No requiere dominio verificado — envía a cualquier destinatario.

Configuración en Render (env vars):
  GMAIL_USER         → tu dirección Gmail (ej: lautimarino17@gmail.com)
  GMAIL_APP_PASSWORD → contraseña de aplicación de 16 caracteres
                       (Google Account → Seguridad → Contraseñas de aplicación)
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

GMAIL_USER     = os.getenv("GMAIL_USER", "")
GMAIL_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")


def _send(to: str, subject: str, html: str) -> bool:
    """Envía un email via Gmail SMTP. Retorna True si tuvo éxito."""
    if not GMAIL_USER or not GMAIL_PASSWORD:
        print(f"[EMAIL] GMAIL_USER / GMAIL_APP_PASSWORD no configuradas. Destinatario: {to}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"SecretarIA <{GMAIL_USER}>"
        msg["To"]      = to
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_PASSWORD)
            server.sendmail(GMAIL_USER, to, msg.as_string())
        return True
    except Exception as e:
        print(f"[EMAIL] Error al enviar a {to}: {e}")
        return False


def send_appointment_assigned(patient_email: str, patient_name: str, prof_name: str, formatted_dt: str, lugar: str = "") -> bool:
    """Notifica al paciente que le fue asignado un turno."""
    subject = "Nuevo turno asignado"
    lugar_line = f"<p>📍 <strong>{lugar}</strong></p>" if lugar else ""
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#16a34a">Turno asignado</h2>
      <p>Hola <strong>{patient_name}</strong>,</p>
      <p>Tu profesional <strong>{prof_name}</strong> te asignó un turno:</p>
      <p>📅 <strong>{formatted_dt}</strong></p>
      {lugar_line}
      <br><p style="color:#888;font-size:12px">SecretarIA — gestión de salud</p>
    </div>
    """
    return _send(patient_email, subject, html)


def send_appointment_cancelled(patient_email: str, patient_name: str, prof_name: str, formatted_dt: str) -> bool:
    """Notifica al paciente que su turno fue cancelado por el profesional."""
    subject = "Tu turno fue cancelado"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#e53935">Turno cancelado</h2>
      <p>Hola <strong>{patient_name}</strong>,</p>
      <p>Tu turno del <strong>{formatted_dt}</strong> con <strong>{prof_name}</strong> fue cancelado.</p>
      <br><p style="color:#888;font-size:12px">SecretarIA — gestión de salud</p>
    </div>
    """
    return _send(patient_email, subject, html)


def send_routine_by_email(patient_email: str, patient_name: str, prof_name: str, routine_title: str, routine_html: str) -> bool:
    """Envía una rutina por email al paciente."""
    subject = f"Tu rutina: {routine_title}"
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#16a34a">Rutina de ejercicios</h2>
      <p>Hola <strong>{patient_name}</strong>,</p>
      <p>Tu profesional <strong>{prof_name}</strong> te compartió la siguiente rutina:</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
      {routine_html}
      <br><p style="color:#888;font-size:12px">SecretarIA — gestión de salud</p>
    </div>
    """
    return _send(patient_email, subject, html)


def send_appointment_reminder(patient_email: str, patient_name: str, prof_name: str, formatted_dt: str, lugar: str = "") -> bool:
    """Recordatorio de turno próximo al paciente."""
    subject = "Recordatorio: tenés un turno mañana"
    lugar_line = f"<p>📍 Lugar: <strong>{lugar}</strong></p>" if lugar else ""
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2 style="color:#1976d2">Recordatorio de turno</h2>
      <p>Hola <strong>{patient_name}</strong>,</p>
      <p>Te recordamos que tenés un turno con <strong>{prof_name}</strong>:</p>
      <p>📅 <strong>{formatted_dt}</strong></p>
      {lugar_line}
      <br><p style="color:#888;font-size:12px">SecretarIA — gestión de salud</p>
    </div>
    """
    return _send(patient_email, subject, html)
