import random
import string
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from dependencies import get_current_user, require_professional
from services.firebase_service import set_user_role, get_user, get_firestore
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

router = APIRouter()


class SetRoleRequest(BaseModel):
    uid: str
    role: str
    dni: Optional[str] = None  # Requerido para pacientes


def _generate_code() -> str:
    """Genera un código legible tipo DR-A3X9."""
    chars = string.ascii_uppercase + string.digits
    suffix = ''.join(random.choices(chars, k=4))
    return f"DR-{suffix}"


@router.post("/set-role")
def set_role(body: SetRoleRequest):
    """Asigna el rol y genera el código de vinculación si es profesional."""
    try:
        set_user_role(body.uid, body.role)

        if body.role == "patient":
            # Sincronizar con TODOS los médicos que tienen este DNI en el registry global
            try:
                db = get_firestore()
                user_profile = get_user(body.uid)
                display_name = user_profile.get("display_name", "")
                email = (user_profile.get("email", "") or "").strip().lower()
                dni = (body.dni or "").strip()

                parts = display_name.split(" ", 1) if display_name else []
                nombre_real = parts[0] if parts else ""
                apellido_real = parts[1] if len(parts) > 1 else ""

                professionals_in_registry = []

                # 1) Buscar por DNI en el registry (fuente de verdad)
                if dni:
                    reg_doc = db.collection("patient_registry").document(dni).get()
                    if reg_doc.exists:
                        professionals_in_registry = reg_doc.to_dict().get("professionals", [])
                        # Actualizar email en el registry si no lo tenía
                        if email and not reg_doc.to_dict().get("email"):
                            reg_doc.reference.update({"email": email})

                # 2) Fallback: buscar por email si no encontró nada por DNI
                if not professionals_in_registry and email:
                    patient_docs = db.collection_group("patients") \
                        .where("email", "==", email).stream()
                    for pd in patient_docs:
                        prof_uid_found = pd.reference.parent.parent.id
                        professionals_in_registry.append({
                            "prof_uid": prof_uid_found,
                            "patient_doc_id": pd.id
                        })

                # Sincronizar con CADA profesional que tiene este paciente
                primary_link_set = db.collection("patient_links").document(body.uid).get().exists
                for entry in professionals_in_registry:
                    prof_uid = entry["prof_uid"]
                    patient_doc_id = entry["patient_doc_id"]
                    patient_ref = db.collection("professionals").document(prof_uid) \
                        .collection("patients").document(patient_doc_id)

                    # Actualizar nombre real en el doc del paciente
                    pat_updates = {"patient_uid_app": body.uid}
                    if nombre_real:
                        pat_updates["nombre"] = nombre_real
                    if apellido_real is not None:
                        pat_updates["apellido"] = apellido_real
                    try:
                        patient_ref.update(pat_updates)
                    except Exception:
                        pass

                    # Actualizar appointments
                    appts = db.collection("professionals").document(prof_uid) \
                        .collection("appointments") \
                        .where("patient_doc_id", "==", patient_doc_id).stream()
                    appt_updates = {"patient_uid": body.uid}
                    if display_name:
                        appt_updates["patient_name"] = display_name
                    for appt in appts:
                        try:
                            appt.reference.update(appt_updates)
                        except Exception:
                            pass

                    # Crear el patient_link primario con el primer profesional encontrado
                    if not primary_link_set:
                        db.collection("patient_links").document(body.uid).set({
                            "professional_uid": prof_uid,
                            "patient_doc_id": patient_doc_id,
                            "patient_email": email,
                            "patient_dni": dni,
                            "linked_at": SERVER_TIMESTAMP,
                            "auto_linked": True
                        })
                        primary_link_set = True
            except Exception:
                pass  # No fallar el registro por esto

        if body.role == "professional":
            db = get_firestore()
            prof_ref = db.collection("professionals").document(body.uid)
            doc = prof_ref.get()

            # Solo genera código si no tiene uno ya
            if not doc.exists or not doc.to_dict().get("link_code"):
                # Garantizar que el código sea único
                code = _generate_code()
                while True:
                    existing = db.collection("professionals") \
                        .where("link_code", "==", code).limit(1).stream()
                    if not any(True for _ in existing):
                        break
                    code = _generate_code()

                prof_ref.set({
                    "uid": body.uid,
                    "link_code": code,
                    "created_at": SERVER_TIMESTAMP
                }, merge=True)

        return {"message": f"Rol '{body.role}' asignado al usuario {body.uid}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    """Retorna la información del usuario autenticado, incluyendo el link_code si es profesional."""
    try:
        profile = get_user(user["uid"])
        result = {
            "uid": profile["uid"],
            "email": profile["email"],
            "display_name": profile["display_name"],
            "role": profile["custom_claims"].get("role", None),
            "link_code": None
        }

        if result["role"] == "professional":
            db = get_firestore()
            doc = db.collection("professionals").document(user["uid"]).get()
            if doc.exists:
                result["link_code"] = doc.to_dict().get("link_code")

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/link-code")
def get_link_code(user: dict = Depends(get_current_user)):
    """Profesional: obtiene su código de vinculación."""
    require_professional(user)
    db = get_firestore()
    doc = db.collection("professionals").document(user["uid"]).get()
    if not doc.exists or not doc.to_dict().get("link_code"):
        raise HTTPException(status_code=404, detail="No tenés código generado. Cerrá sesión y volvé a entrar.")
    return {"link_code": doc.to_dict()["link_code"]}


class LinkProfessionalRequest(BaseModel):
    link_code: str
    dni: str


@router.post("/link-professional")
def link_to_professional(body: LinkProfessionalRequest, user: dict = Depends(get_current_user)):
    """Paciente: se vincula a un profesional usando el código DR-XXXX y su DNI.
    Si no existe el paciente en la colección del profesional, lo crea automáticamente.
    Guarda professional_uid y patient_doc_id en patient_links/{uid} para acceso directo."""
    if user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Solo pacientes pueden vincularse")

    db = get_firestore()
    code = body.link_code.upper().strip()
    dni = body.dni.strip()

    if not dni:
        raise HTTPException(status_code=400, detail="El DNI es requerido")

    # Buscar el profesional por código
    prof_docs = db.collection("professionals").where("link_code", "==", code).limit(1).stream()
    prof_doc = next(prof_docs, None)
    if prof_doc is None:
        raise HTTPException(status_code=404, detail="Código inválido")

    prof_uid = prof_doc.id

    # Buscar el doc del paciente en la subcolección del profesional por DNI
    patient_docs = db.collection("professionals").document(prof_uid) \
        .collection("patients").where("dni", "==", dni).limit(1).stream()
    patient_doc = next(patient_docs, None)

    if patient_doc:
        patient_doc_id = patient_doc.id
    else:
        # Auto-crear el paciente con los datos disponibles del usuario de Firebase
        try:
            prof_profile = get_user(user["uid"])
            display_name = prof_profile.get("display_name") or ""
        except Exception:
            display_name = ""
        parts = display_name.split(" ", 1)
        nombre = parts[0] if parts else ""
        apellido = parts[1] if len(parts) > 1 else ""

        new_patient = {
            "nombre": nombre,
            "apellido": apellido,
            "dni": dni,
            "email": user.get("email", ""),
            "fecha_nacimiento": "",
            "sexo": "",
            "professional_uid": prof_uid,
            "self_registered": True,
            "created_at": SERVER_TIMESTAMP
        }
        ref = db.collection("professionals").document(prof_uid).collection("patients")
        doc = ref.add(new_patient)
        patient_doc_id = doc[1].id

    # Guardar el vínculo
    patient_email = (user.get("email", "") or "").strip().lower()
    db.collection("patient_links").document(user["uid"]).set({
        "professional_uid": prof_uid,
        "patient_doc_id": patient_doc_id,
        "patient_email": patient_email,
        "patient_dni": dni,
        "linked_at": SERVER_TIMESTAMP
    })

    # Registrar en el registry global por DNI
    try:
        from routers.patients import _register_patient
        _register_patient(db, prof_uid, patient_doc_id, dni, patient_email)
    except Exception:
        pass

    return {"professional_uid": prof_uid, "patient_doc_id": patient_doc_id}


class LinkRequestCreate(BaseModel):
    link_code: str
    dni: str
    nombre: str
    apellido: str
    mensaje: Optional[str] = ""


class LinkRequestAction(BaseModel):
    request_id: str
    action: str  # "accept" | "reject"


@router.post("/request-link")
def request_link(body: LinkRequestCreate, user: dict = Depends(get_current_user)):
    """Paciente: envía solicitud de vinculación que el profesional debe confirmar."""
    if user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Solo pacientes pueden solicitar vinculación")

    db = get_firestore()
    code = body.link_code.upper().strip()
    dni = body.dni.strip()

    if not dni:
        raise HTTPException(status_code=400, detail="El DNI es requerido")

    # Buscar el profesional
    prof_docs = db.collection("professionals").where("link_code", "==", code).limit(1).stream()
    prof_doc = next(prof_docs, None)
    if prof_doc is None:
        raise HTTPException(status_code=404, detail="Código inválido")

    prof_uid = prof_doc.id

    # Evitar solicitudes duplicadas pendientes
    existing = db.collection("professionals").document(prof_uid) \
        .collection("link_requests") \
        .where("patient_uid", "==", user["uid"]) \
        .where("status", "==", "pending").limit(1).stream()
    if next(existing, None):
        raise HTTPException(status_code=409, detail="Ya tenés una solicitud pendiente con este profesional")

    req_data = {
        "patient_uid": user["uid"],
        "patient_email": user.get("email", ""),
        "patient_nombre": body.nombre.strip(),
        "patient_apellido": body.apellido.strip(),
        "patient_dni": dni,
        "mensaje": body.mensaje or "",
        "status": "pending",
        "created_at": SERVER_TIMESTAMP,
    }
    ref = db.collection("professionals").document(prof_uid).collection("link_requests")
    doc = ref.add(req_data)
    return {"id": doc[1].id, "message": "Solicitud enviada correctamente"}


@router.get("/link-requests")
def list_link_requests(user: dict = Depends(get_current_user)):
    """Profesional: lista las solicitudes de vinculación pendientes."""
    require_professional(user)
    db = get_firestore()
    docs = db.collection("professionals").document(user["uid"]) \
        .collection("link_requests").where("status", "==", "pending").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.post("/link-requests/action")
def action_link_request(body: LinkRequestAction, user: dict = Depends(get_current_user)):
    """Profesional: acepta o rechaza una solicitud de vinculación."""
    require_professional(user)
    if body.action not in ("accept", "reject"):
        raise HTTPException(status_code=400, detail="Acción inválida")

    db = get_firestore()
    req_ref = db.collection("professionals").document(user["uid"]) \
        .collection("link_requests").document(body.request_id)
    req_doc = req_ref.get()
    if not req_doc.exists:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    req_data = req_doc.to_dict()
    if req_data.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Solicitud ya procesada")

    if body.action == "reject":
        req_ref.update({"status": "rejected"})
        return {"message": "Solicitud rechazada"}

    # Aceptar: crear o encontrar el paciente, luego crear el vínculo
    prof_uid = user["uid"]
    dni = req_data.get("patient_dni", "").strip()
    patient_uid = req_data.get("patient_uid", "")

    # Buscar si ya existe el paciente por DNI
    patient_docs = db.collection("professionals").document(prof_uid) \
        .collection("patients").where("dni", "==", dni).limit(1).stream()
    patient_doc = next(patient_docs, None)

    if patient_doc:
        patient_doc_id = patient_doc.id
    else:
        new_patient = {
            "nombre": req_data.get("patient_nombre", ""),
            "apellido": req_data.get("patient_apellido", ""),
            "dni": dni,
            "email": req_data.get("patient_email", ""),
            "fecha_nacimiento": "",
            "sexo": "",
            "professional_uid": prof_uid,
            "self_registered": True,
            "created_at": SERVER_TIMESTAMP,
        }
        ref = db.collection("professionals").document(prof_uid).collection("patients")
        doc = ref.add(new_patient)
        patient_doc_id = doc[1].id

    patient_email = (req_data.get("patient_email", "") or "").strip().lower()
    # Guardar vínculo en patient_links
    db.collection("patient_links").document(patient_uid).set({
        "professional_uid": prof_uid,
        "patient_doc_id": patient_doc_id,
        "patient_email": patient_email,
        "patient_dni": dni,
        "linked_at": SERVER_TIMESTAMP,
    })

    # Registrar en el registry global por DNI
    try:
        from routers.patients import _register_patient
        _register_patient(db, prof_uid, patient_doc_id, dni, patient_email)
    except Exception:
        pass

    req_ref.update({"status": "accepted", "patient_doc_id": patient_doc_id})
    return {"message": "Solicitud aceptada. Paciente vinculado.", "patient_doc_id": patient_doc_id}


@router.get("/my-link-status")
def get_my_link_status(user: dict = Depends(get_current_user)):
    """Paciente: verifica si su solicitud fue aceptada, rechazada o está pendiente."""
    if user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Solo pacientes")
    db = get_firestore()
    # Buscar entre todas las solicitudes que coincidan con el patient_uid
    docs = db.collection_group("link_requests") \
        .where("patient_uid", "==", user["uid"]).stream()
    results = sorted([{"id": d.id, **d.to_dict()} for d in docs],
                     key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return results


class ProfessionalProfileUpdate(BaseModel):
    telefono: Optional[str] = None
    lugares_atencion: Optional[List[str]] = None


@router.get("/professional-profile")
def get_professional_profile(user: dict = Depends(get_current_user)):
    """Profesional: obtiene su perfil (teléfono y lugares de atención)."""
    require_professional(user)
    db = get_firestore()
    doc = db.collection("professionals").document(user["uid"]).get()
    data = doc.to_dict() if doc.exists else {}
    return {
        "telefono": data.get("telefono", ""),
        "lugares_atencion": data.get("lugares_atencion", [])
    }


@router.patch("/professional-profile")
def update_professional_profile(body: ProfessionalProfileUpdate, user: dict = Depends(get_current_user)):
    """Profesional: actualiza teléfono y/o lugares de atención."""
    require_professional(user)
    db = get_firestore()
    updates = {}
    if body.telefono is not None:
        updates["telefono"] = body.telefono
    if body.lugares_atencion is not None:
        updates["lugares_atencion"] = body.lugares_atencion
    if not updates:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")
    db.collection("professionals").document(user["uid"]).set(updates, merge=True)
    return {"message": "Perfil actualizado"}


@router.patch("/patient-phone")
def update_patient_phone(body: dict, user: dict = Depends(get_current_user)):
    """Paciente: guarda su número de teléfono en su vínculo y en su doc de paciente."""
    if user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Solo pacientes")
    telefono = body.get("telefono", "").strip()
    db = get_firestore()
    # Guardar en patient_links
    db.collection("patient_links").document(user["uid"]).set({"telefono": telefono}, merge=True)
    # También actualizar en el doc del paciente si está vinculado
    link_doc = db.collection("patient_links").document(user["uid"]).get()
    if link_doc.exists:
        link = link_doc.to_dict()
        prof_uid = link.get("professional_uid")
        patient_doc_id = link.get("patient_doc_id")
        if prof_uid and patient_doc_id:
            db.collection("professionals").document(prof_uid) \
                .collection("patients").document(patient_doc_id) \
                .set({"telefono": telefono}, merge=True)
    return {"message": "Teléfono actualizado"}


@router.get("/my-link")
def get_my_link(user: dict = Depends(get_current_user)):
    """Paciente: obtiene su vínculo con nombre y código del profesional."""
    if user.get("role") != "patient":
        raise HTTPException(status_code=403, detail="Solo pacientes")
    db = get_firestore()
    doc = db.collection("patient_links").document(user["uid"]).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="No vinculado")
    data = doc.to_dict()
    prof_uid = data.get("professional_uid", "")
    # Enriquecer con nombre y código del profesional
    try:
        prof_profile = get_user(prof_uid)
        data["professional_name"] = prof_profile.get("display_name") or prof_profile.get("email", "")
    except Exception:
        data["professional_name"] = ""
    try:
        prof_doc = db.collection("professionals").document(prof_uid).get()
        data["link_code"] = prof_doc.to_dict().get("link_code", "") if prof_doc.exists else ""
    except Exception:
        data["link_code"] = ""
    return data


@router.get("/resolve-code/{code}")
def resolve_code(code: str, user: dict = Depends(get_current_user)):
    """Paciente: resuelve un código de vinculación y devuelve el uid y nombre del profesional."""
    docs = get_firestore().collection("professionals") \
        .where("link_code", "==", code.upper().strip()).limit(1).stream()
    doc = next(docs, None)
    if doc is None:
        raise HTTPException(status_code=404, detail="Código inválido. Verificá con tu profesional.")

    data = doc.to_dict()
    prof_uid = doc.id

    # Obtener nombre del profesional desde Firebase Auth
    try:
        prof_profile = get_user(prof_uid)
        display_name = prof_profile.get("display_name") or prof_profile.get("email", "")
    except Exception:
        display_name = ""

    return {
        "professional_uid": prof_uid,
        "display_name": display_name
    }


@router.post("/admin/sync-registry")
def sync_patient_registry(user: dict = Depends(get_current_user)):
    """Profesional: reconstruye el patient_registry escaneando sus propios pacientes.
    Útil para migrar datos existentes al nuevo modelo."""
    require_professional(user)
    db = get_firestore()
    from routers.patients import _register_patient
    patients = db.collection("professionals").document(user["uid"]).collection("patients").stream()
    synced = 0
    for p in patients:
        pdata = p.to_dict()
        dni = (pdata.get("dni") or "").strip()
        email = (pdata.get("email") or "").strip().lower()
        if dni:
            try:
                _register_patient(db, user["uid"], p.id, dni, email)
                synced += 1
            except Exception:
                pass
    return {"synced": synced, "message": f"Registry sincronizado: {synced} pacientes"}
