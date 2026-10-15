import re
import secrets
from datetime import datetime, timezone
from typing import Optional, Dict, Any

class AuthService:
    def __init__(self):
        self.default_token = "officer-token-f0d0d9073de6b0fa7932ffe9b4f9c7b2"
        # Pre-registered default authorized municipal officer profile
        self.default_officer: Dict[str, Any] = {
            "name": "Kishore",
            "role": "Chief Municipal Health Officer",
            "jurisdiction": "Coimbatore Municipal Corporation (District 3331)",
            "email": "24121027@drngpit.ac.in",
            "contact_number": "+919345791866",
            "department": "Public Health & Epidemic Surveillance Division",
            "token": self.default_token,
            "is_authenticated": True,
            "logged_in_at": datetime.now(timezone.utc).isoformat(),
        }

        # Active token-backed session table: token -> officer dictionary
        self.sessions: Dict[str, Dict[str, Any]] = {
            self.default_token: self.default_officer.copy(),
        }
        self.current_officer: Dict[str, Any] = self.default_officer.copy()

    def validate_email(self, email: str) -> bool:
        if not email or "@" not in email:
            return False
        return bool(re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", email.strip()))

    def validate_phone(self, phone: str) -> bool:
        if not phone:
            return False
        clean = re.sub(r"[\s\-\(\)]", "", str(phone))
        return bool(re.match(r"^(\+91|0)?[6-9]\d{9}$", clean) or re.match(r"^\+[1-9]\d{7,14}$", clean))

    def authenticate(self, email: str, contact_number: str, name: Optional[str] = None, password: Optional[str] = None) -> Dict[str, Any]:
        """
        Authenticate or register the municipal officer.
        Validates email format and mobile number, generates a secure session token.
        """
        if not self.validate_email(email):
            raise ValueError(f"Invalid email format: '{email}'. A valid public health or municipal email address is required.")

        if not self.validate_phone(contact_number):
            raise ValueError(f"Invalid contact number: '{contact_number}'. Must be a valid 10-digit mobile number or E.164 international format.")

        # Format contact number to standard +91 if needed
        clean_phone = re.sub(r"[\s\-\(\)]", "", contact_number)
        if not clean_phone.startswith("+"):
            if clean_phone.startswith("0"):
                clean_phone = "+91" + clean_phone[1:]
            elif len(clean_phone) == 10:
                clean_phone = "+91" + clean_phone

        token = f"officer-token-{secrets.token_hex(16)}"
        officer_name = name or (
            "Dr. K. Sundaram" if "sundaram" in email.lower() or "officer" in email.lower()
            else email.split("@")[0].replace(".", " ").title() + " (Municipal Officer)"
        )

        officer = {
            "name": officer_name,
            "role": "Chief Municipal Health Officer",
            "jurisdiction": "Coimbatore Municipal Corporation (District 3331)",
            "email": email.strip().lower(),
            "contact_number": clean_phone,
            "department": "Public Health & Epidemic Surveillance Division",
            "token": token,
            "is_authenticated": True,
            "logged_in_at": datetime.now(timezone.utc).isoformat(),
        }

        # Store session
        self.sessions[token] = officer
        self.current_officer = officer
        return officer

    def verify_token(self, token: Optional[str]) -> Optional[Dict[str, Any]]:
        """Verifies session token against active session database."""
        if not token:
            return None
        clean_token = token.replace("Bearer ", "").strip()
        officer = self.sessions.get(clean_token)
        if officer and officer.get("is_authenticated"):
            return officer
        return None

    def get_current_officer(self) -> Dict[str, Any]:
        return self.current_officer

    def logout(self, token: Optional[str] = None) -> None:
        """Revokes token and de-authenticates officer session."""
        if token:
            clean_token = token.replace("Bearer ", "").strip()
            self.sessions.pop(clean_token, None)
        self.current_officer["is_authenticated"] = False
        self.current_officer["token"] = None


auth_service = AuthService()
