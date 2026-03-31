import firebase_admin
from firebase_admin import credentials, auth, firestore
from dotenv import load_dotenv
import os
import json

load_dotenv()

_initialized = False


def init_firebase():
    global _initialized
    if not _initialized:
        # En producción (Render) las credenciales vienen como JSON en variable de entorno
        cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
        if cred_json:
            cred = credentials.Certificate(json.loads(cred_json))
        else:
            cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "./firebase-adminsdk.json")
            cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        _initialized = True


def get_firestore():
    init_firebase()
    return firestore.client()


def verify_token(id_token: str) -> dict:
    """Verifica el token de Firebase y retorna los claims del usuario."""
    init_firebase()
    try:
        decoded = auth.verify_id_token(id_token)
        return decoded
    except Exception as e:
        raise ValueError(f"Token inválido: {str(e)}")


def set_user_role(uid: str, role: str):
    """Asigna el rol (patient / professional) como custom claim."""
    init_firebase()
    if role not in ("patient", "professional"):
        raise ValueError("Rol inválido. Debe ser 'patient' o 'professional'")
    auth.set_custom_user_claims(uid, {"role": role})


def get_user(uid: str) -> dict:
    init_firebase()
    user = auth.get_user(uid)
    return {
        "uid": user.uid,
        "email": user.email,
        "display_name": user.display_name,
        "custom_claims": user.custom_claims or {}
    }
