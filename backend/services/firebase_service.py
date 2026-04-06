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


def get_all_patient_links(db, patient_uid: str) -> list[dict]:
    """
    Retorna todos los vínculos {prof_uid, patient_doc_id} de un paciente.
    Soporta el nuevo formato (subcollección) y el formato viejo (doc padre),
    migrando automáticamente el viejo al nuevo al primer acceso.
    """
    from google.cloud.firestore_v1 import SERVER_TIMESTAMP

    # Nuevo formato: subcollección professionals
    prof_docs = list(
        db.collection("patient_links").document(patient_uid)
          .collection("professionals").stream()
    )
    if prof_docs:
        return [
            {"prof_uid": d.id, "patient_doc_id": d.to_dict().get("patient_doc_id", "")}
            for d in prof_docs
        ]

    # Formato viejo: campos en el doc padre
    parent_doc = db.collection("patient_links").document(patient_uid).get()
    if not parent_doc.exists:
        return []

    parent_data = parent_doc.to_dict()
    prof_uid = parent_data.get("professional_uid", "")
    patient_doc_id = parent_data.get("patient_doc_id", "")
    if not prof_uid or not patient_doc_id:
        return []

    # Migrar al nuevo formato automáticamente
    try:
        db.collection("patient_links").document(patient_uid) \
          .collection("professionals").document(prof_uid).set({
              "patient_doc_id": patient_doc_id,
              "linked_at": SERVER_TIMESTAMP,
              "auto_migrated": True,
          })
    except Exception:
        pass

    return [{"prof_uid": prof_uid, "patient_doc_id": patient_doc_id}]
