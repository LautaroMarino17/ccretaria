"""
Dependencias compartidas entre routers.
Valida el token de Firebase en cada request protegido.
"""
from fastapi import Header, HTTPException, status
from services.firebase_service import verify_token


def get_current_user(authorization: str = Header(...)) -> dict:
    print(f"[AUTH] Header recibido: {authorization[:30]}...")
    """
    Extrae y valida el Bearer token de Firebase.
    Retorna los claims del usuario autenticado.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Formato de autorización inválido. Use 'Bearer <token>'"
        )

    token = authorization.split(" ", 1)[1]

    try:
        claims = verify_token(token)
        return claims
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )


def require_professional(user: dict = None) -> dict:
    """Verifica que el usuario tenga rol 'professional'."""
    role = (user.get("role") or "").strip()
    if role != "professional":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta acción requiere rol de profesional"
        )
    return user


def require_patient(user: dict = None) -> dict:
    """Verifica que el usuario tenga rol 'patient'."""
    role = (user.get("role") or "").strip()
    if role != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta acción requiere rol de paciente"
        )
    return user


def require_plan(min_plan: int):
    """Factory: retorna una dependencia que exige plan >= min_plan para profesionales."""
    from fastapi import Depends
    from services.firebase_service import get_firestore

    def _check(user: dict = Depends(get_current_user)):
        require_professional(user)
        db = get_firestore()
        doc = db.collection("professionals").document(user["uid"]).get()
        plan = int(doc.to_dict().get("plan", 1)) if doc.exists else 1
        if plan < min_plan:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Esta función requiere el Plan {min_plan} o superior"
            )
        return user
    return _check
