from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.services.auth_service import auth_service

security = HTTPBearer(auto_error=False)

def get_current_officer(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_officer_token: Optional[str] = Header(None, alias="X-Officer-Token"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """
    FastAPI security dependency to protect surveillance dashboard APIs.
    Requires a valid token obtained via /api/auth/login.
    Supports Authorization Bearer header, X-Officer-Token header, or Bearer credentials.
    """
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif authorization:
        token = authorization.replace("Bearer ", "").strip()
    elif x_officer_token:
        token = x_officer_token.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in through the Municipal Officer Portal to access surveillance data.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    officer = auth_service.verify_token(token)
    if not officer or not officer.get("is_authenticated"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token. Please authenticate again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return officer
