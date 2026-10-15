import sqlite3
import json
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logger = logging.getLogger("epidemiology.db")

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "epidemiology.db"


def get_db_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with row_factory enabled for dict-like access."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes the SQLite database tables and indexes."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # 1. Officers table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS officers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                name TEXT NOT NULL,
                contact_number TEXT,
                role TEXT DEFAULT 'Chief Municipal Health Officer',
                jurisdiction TEXT DEFAULT 'Coimbatore Municipal Corporation (District 3331)',
                department TEXT DEFAULT 'Public Health & Epidemic Surveillance Division',
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # 2. Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                officer_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (officer_id) REFERENCES officers (id) ON DELETE CASCADE
            );
        """)

        # 3. Email audit log table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_audit_log (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                recipient_email TEXT NOT NULL,
                recipient_name TEXT,
                district TEXT DEFAULT 'Coimbatore',
                ward TEXT,
                disease TEXT,
                risk_level TEXT,
                prediction_date TEXT,
                subject TEXT,
                status TEXT NOT NULL,
                delivery_status TEXT NOT NULL,
                carrier_stage TEXT,
                delivery_confirmed INTEGER DEFAULT 0,
                smtp_server TEXT,
                recommended_actions TEXT,
                status_note TEXT,
                error TEXT,
                is_demo INTEGER DEFAULT 0,
                is_test INTEGER DEFAULT 0
            );
        """)

        # 4. SMS audit log table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sms_audit_log (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                recipient_phone TEXT NOT NULL,
                recipient_name TEXT,
                district TEXT DEFAULT 'Coimbatore',
                ward TEXT,
                disease TEXT,
                risk_level TEXT,
                prediction_date TEXT,
                message TEXT NOT NULL,
                status TEXT NOT NULL,
                delivery_status TEXT NOT NULL,
                carrier_stage TEXT,
                delivery_confirmed INTEGER DEFAULT 0,
                provider TEXT,
                provider_id TEXT,
                status_note TEXT,
                error TEXT,
                is_demo INTEGER DEFAULT 0,
                is_test INTEGER DEFAULT 0
            );
        """)

        # Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_officers_email ON officers(email);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_email_audit_timestamp ON email_audit_log(timestamp);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sms_audit_timestamp ON sms_audit_log(timestamp);")

        # Safely migrate existing columns if they don't exist
        existing_cols = [r["name"] for r in cursor.execute("PRAGMA table_info(email_audit_log)").fetchall()]
        for col_name, col_type in [
            ("recipient_name", "TEXT"),
            ("district", "TEXT DEFAULT 'Coimbatore'"),
            ("ward", "TEXT"),
            ("delivery_status", "TEXT"),
            ("carrier_stage", "TEXT"),
            ("delivery_confirmed", "INTEGER DEFAULT 0"),
            ("smtp_server", "TEXT"),
            ("recommended_actions", "TEXT"),
            ("status_note", "TEXT"),
            ("is_demo", "INTEGER DEFAULT 0")
        ]:
            if col_name not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE email_audit_log ADD COLUMN {col_name} {col_type};")
                except Exception:
                    pass

        conn.commit()
        logger.info(f"Epidemiology database initialized at {DB_PATH}")
    except Exception as e:
        logger.error(f"Database initialization error: {e}", exc_info=True)
    finally:
        conn.close()


def save_email_audit(record: Dict[str, Any]) -> bool:
    """Saves an email alert dispatch attempt (live or demo) to the SQLite audit log."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        actions = record.get("recommended_actions")
        actions_str = json.dumps(actions) if isinstance(actions, (list, dict)) else str(actions or "")

        cursor.execute("""
            INSERT OR REPLACE INTO email_audit_log (
                id, timestamp, recipient_email, recipient_name, district, ward,
                disease, risk_level, prediction_date, subject, status,
                delivery_status, carrier_stage, delivery_confirmed,
                smtp_server, recommended_actions, status_note, error,
                is_demo, is_test
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(record.get("id")),
            str(record.get("timestamp") or datetime.now(timezone.utc).isoformat()),
            str(record.get("recipient_email") or ""),
            str(record.get("recipient_name") or ""),
            str(record.get("district") or "Coimbatore"),
            str(record.get("ward") or ""),
            str(record.get("disease") or "Dengue"),
            str(record.get("risk_level") or "HIGH RISK"),
            str(record.get("prediction_date") or ""),
            str(record.get("subject") or f"Alert for {record.get('ward', 'Ward')}"),
            str(record.get("status") or "delivered"),
            str(record.get("delivery_status") or "SENT"),
            str(record.get("carrier_stage") or ""),
            1 if record.get("delivery_confirmed") else 0,
            str(record.get("smtp_server") or ""),
            actions_str,
            str(record.get("status_note") or ""),
            str(record.get("error") or "") if record.get("error") else None,
            1 if record.get("is_demo") else 0,
            1 if record.get("is_test") else 0
        ))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Failed to save email audit log: {e}", exc_info=True)
        return False


def save_sms_audit(record: Dict[str, Any]) -> bool:
    """Saves a cellular SMS alert dispatch attempt (live or demo) to the SQLite audit log."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        ward_val = record.get("ward")
        if not ward_val and record.get("wards"):
            ward_val = ", ".join(record.get("wards"))

        cursor.execute("""
            INSERT OR REPLACE INTO sms_audit_log (
                id, timestamp, recipient_phone, recipient_name, district, ward,
                disease, risk_level, prediction_date, message, status,
                delivery_status, carrier_stage, delivery_confirmed,
                provider, provider_id, status_note, error,
                is_demo, is_test
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            str(record.get("id")),
            str(record.get("timestamp") or datetime.now(timezone.utc).isoformat()),
            str(record.get("recipient_phone") or ""),
            str(record.get("recipient_name") or ""),
            str(record.get("district") or "Coimbatore"),
            str(ward_val or ""),
            str(record.get("disease") or "Dengue"),
            str(record.get("risk_level") or "HIGH RISK"),
            str(record.get("prediction_date") or ""),
            str(record.get("message") or ""),
            str(record.get("status") or "delivered"),
            str(record.get("delivery_status") or "SENT"),
            str(record.get("carrier_stage") or ""),
            1 if record.get("delivery_confirmed") else 0,
            str(record.get("provider") or record.get("gateway") or ""),
            str(record.get("provider_id") or "") if record.get("provider_id") else None,
            str(record.get("status_note") or ""),
            str(record.get("error") or "") if record.get("error") else None,
            1 if record.get("is_demo") else 0,
            1 if record.get("is_test") else 0
        ))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Failed to save SMS audit log: {e}", exc_info=True)
        return False


def get_email_audits(limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieves recent email audit log rows from the SQLite database."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        rows = cursor.execute("""
            SELECT * FROM email_audit_log
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,)).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["delivery_confirmed"] = bool(d.get("delivery_confirmed", 0))
            d["is_demo"] = bool(d.get("is_demo", 0))
            d["is_test"] = bool(d.get("is_test", 0))
            if d.get("recommended_actions"):
                try:
                    d["recommended_actions"] = json.loads(d["recommended_actions"])
                except Exception:
                    pass
            results.append(d)
        conn.close()
        return results
    except Exception as e:
        logger.error(f"Failed to read email audits: {e}")
        return []


def get_sms_audits(limit: int = 100) -> List[Dict[str, Any]]:
    """Retrieves recent SMS audit log rows from the SQLite database."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        rows = cursor.execute("""
            SELECT * FROM sms_audit_log
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,)).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["delivery_confirmed"] = bool(d.get("delivery_confirmed", 0))
            d["is_demo"] = bool(d.get("is_demo", 0))
            d["is_test"] = bool(d.get("is_test", 0))
            if d.get("ward"):
                d["wards"] = [w.strip() for w in d["ward"].split(",")]
            results.append(d)
        conn.close()
        return results
    except Exception as e:
        logger.error(f"Failed to read SMS audits: {e}")
        return []


def clear_email_audits() -> bool:
    """Clears all email audit records from SQLite database."""
    try:
        conn = get_db_connection()
        conn.execute("DELETE FROM email_audit_log")
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Failed to clear email audits: {e}")
        return False


def clear_sms_audits() -> bool:
    """Clears all SMS audit records from SQLite database."""
    try:
        conn = get_db_connection()
        conn.execute("DELETE FROM sms_audit_log")
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Failed to clear SMS audits: {e}")
        return False


# Auto-initialize on module load
try:
    init_db()
except Exception:
    pass
