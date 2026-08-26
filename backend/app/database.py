import os
import sqlite3
import hashlib
import logging
from contextlib import contextmanager

# TEMP DIAGNOSTIC LOGGING — sender persistence investigation.
# Safe to remove once the root cause is confirmed and fixed; purely
# observational, no behavior change.
logger = logging.getLogger("sender_diagnostics")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("[SENDER-DIAG] %(asctime)s %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_NAME = os.getenv("DATABASE_URL", os.path.join(BASE_DIR, "users.db"))
if DB_NAME.startswith("sqlite:///"):
    DB_NAME = DB_NAME.replace("sqlite:///", "")

SMTP_PROVIDERS = {
    "smtp2go": {"host": "mail.smtp2go.com", "port": 587, "use_tls": True, "user_is_apikey": True},
    "sendgrid": {"host": "smtp.sendgrid.net", "port": 587, "use_tls": True, "user_is_apikey": True},
    "mailgun": {"host": "smtp.mailgun.org", "port": 587, "use_tls": True, "user_is_apikey": False},
    "gmail": {"host": "smtp.gmail.com", "port": 465, "use_tls": True, "user_is_apikey": False},
}


def resolve_smtp_config(provider: str, email: str, api_key_or_password: str, custom_host=None, custom_port=None):
    prov = SMTP_PROVIDERS.get(provider)
    if prov:
        host = prov["host"]
        port = prov["port"]
        use_tls = prov["use_tls"]
        user = api_key_or_password if prov["user_is_apikey"] else email
        password = api_key_or_password
    else:
        host = custom_host or "smtp.gmail.com"
        port = custom_port or 465
        use_tls = True
        user = email
        password = api_key_or_password
    return host, port, user, password, use_tls


# =========================
# CONNECTION CONTEXT MANAGER
# ✅ FIX: Use per-request connections with WAL mode to prevent
#         "database is locked" on Render (multi-threaded uvicorn).
# =========================
@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DB_NAME, timeout=30)
    # WAL mode allows concurrent reads + one write without blocking
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# =========================
# HASH PASSWORD
# =========================
def hash_password(password: str):
    if not password:
        return ""
    return hashlib.sha256(password.encode()).hexdigest()


# =========================
# INIT USERS TABLE
# =========================
def init_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE,
                phone TEXT,
                password TEXT,
                role TEXT,
                app_password TEXT
            )
        """)
        # Backward-compatible migration
        cursor.execute("PRAGMA table_info(users)")
        cols = [row[1] for row in cursor.fetchall()]
        if "app_password" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN app_password TEXT")
        # ── ORG DOMAIN MIGRATION ──────────────────────────────────────────
        # New "domain" column stores the extracted email domain (e.g.
        # "company.com") for organizational accounts. NULL for individual
        # accounts. Existing rows are unaffected by this migration; the
        # column is simply added with no data loss.
        if "domain" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN domain TEXT")
        if "reset_token" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN reset_token TEXT")
        if "reset_token_expires" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN reset_token_expires TEXT")
        if "credential_change_token" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN credential_change_token TEXT")
        if "credential_change_expires" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN credential_change_expires TEXT")
        if "credential_change_type" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN credential_change_type TEXT")
        if "pending_email" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN pending_email TEXT")
        if "pending_password_hash" not in cols:
            cursor.execute("ALTER TABLE users ADD COLUMN pending_password_hash TEXT")



# =========================
# CREATE USER
# =========================
def create_user(name, email, phone, password, role, app_password=None, domain=None):
    """
    domain: extracted organizational email domain (e.g. "company.com").
    Only meaningful for role == "organization"; pass None for individual
    accounts. This is purely additive — every existing caller that omits
    `domain` keeps working exactly as before.
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            hashed_password = hash_password(password)
            cursor.execute("""
                INSERT INTO users (name, email, phone, password, role, app_password, domain)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (name, email, phone, hashed_password, role, app_password or None, domain or None))
        return True
    except Exception as e:
        print("DB ERROR:", e)
        return False


# =========================
# VERIFY USER LOGIN
# =========================
def verify_user(email, password):
    user = get_user_by_email(email)
    if not user:
        return None
    if user["password"] == hash_password(password):
        return user
    return None


# =========================
# GET USER
# =========================
def get_user_by_email(email):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()

    if row:
        row_keys = row.keys()
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "phone": row["phone"],
            "password": row["password"],
            "role": row["role"],
            "app_password": row["app_password"] if "app_password" in row_keys else None,
            "domain": row["domain"] if "domain" in row_keys else None,
            "reset_token": row["reset_token"] if "reset_token" in row_keys else None,
            "reset_token_expires": row["reset_token_expires"] if "reset_token_expires" in row_keys else None,
            "credential_change_token": row["credential_change_token"] if "credential_change_token" in row_keys else None,
            "credential_change_expires": row["credential_change_expires"] if "credential_change_expires" in row_keys else None,
            "credential_change_type": row["credential_change_type"] if "credential_change_type" in row_keys else None,
            "pending_email": row["pending_email"] if "pending_email" in row_keys else None,
            "pending_password_hash": row["pending_password_hash"] if "pending_password_hash" in row_keys else None,
        }
    return None


# =========================
# GET USER BY RESET TOKEN
# =========================
def get_user_by_reset_token(token: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE reset_token = ?", (token,))
        row = cursor.fetchone()

    if row:
        row_keys = row.keys()
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "phone": row["phone"],
            "password": row["password"],
            "role": row["role"],
            "app_password": row["app_password"] if "app_password" in row_keys else None,
            "domain": row["domain"] if "domain" in row_keys else None,
            "reset_token": row["reset_token"] if "reset_token" in row_keys else None,
            "reset_token_expires": row["reset_token_expires"] if "reset_token_expires" in row_keys else None,
            "credential_change_token": row["credential_change_token"] if "credential_change_token" in row_keys else None,
            "credential_change_expires": row["credential_change_expires"] if "credential_change_expires" in row_keys else None,
            "credential_change_type": row["credential_change_type"] if "credential_change_type" in row_keys else None,
            "pending_email": row["pending_email"] if "pending_email" in row_keys else None,
            "pending_password_hash": row["pending_password_hash"] if "pending_password_hash" in row_keys else None,
        }
    return None


# =========================
# GET USER BY CREDENTIAL CHANGE TOKEN
# =========================
def get_user_by_credential_change_token(token: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE credential_change_token = ?", (token,))
        row = cursor.fetchone()

    if row:
        row_keys = row.keys()
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "phone": row["phone"],
            "password": row["password"],
            "role": row["role"],
            "app_password": row["app_password"] if "app_password" in row_keys else None,
            "domain": row["domain"] if "domain" in row_keys else None,
            "reset_token": row["reset_token"] if "reset_token" in row_keys else None,
            "reset_token_expires": row["reset_token_expires"] if "reset_token_expires" in row_keys else None,
            "credential_change_token": row["credential_change_token"] if "credential_change_token" in row_keys else None,
            "credential_change_expires": row["credential_change_expires"] if "credential_change_expires" in row_keys else None,
            "credential_change_type": row["credential_change_type"] if "credential_change_type" in row_keys else None,
            "pending_email": row["pending_email"] if "pending_email" in row_keys else None,
            "pending_password_hash": row["pending_password_hash"] if "pending_password_hash" in row_keys else None,
        }
    return None


# =========================
# UPDATE USER RESET TOKEN
# =========================
def update_user_reset_token(email: str, token: str | None, expires: str | None):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?",
            (token, expires, email),
        )


# =========================
# UPDATE USER PASSWORD
# =========================
def update_user_password(email: str, hashed_password: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET password = ? WHERE email = ?",
            (hashed_password, email),
        )


# =========================
# UPDATE USER PROFILE
# =========================
def update_user_profile(user_id: int, name: str, phone: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET name = ?, phone = ? WHERE id = ?",
            (name, phone, user_id),
        )


# =========================
# UPDATE USER PENDING CREDENTIAL CHANGE
# =========================
def update_user_pending_credential_change(email: str, token: str | None, expires_iso: str | None, change_type: str | None, pending_email: str | None, pending_password_hash: str | None):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE users SET 
                credential_change_token = ?, 
                credential_change_expires = ?, 
                credential_change_type = ?, 
                pending_email = ?, 
                pending_password_hash = ? 
               WHERE email = ?""",
            (token, expires_iso, change_type, pending_email, pending_password_hash, email),
        )


# =========================
# CONFIRM USER CREDENTIAL CHANGE
# =========================
def confirm_user_credential_change(email: str, change_type: str, new_value: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if change_type == "email":
            # Check if domain needs to be updated (if organizational user)
            cursor.execute("SELECT role FROM users WHERE email = ?", (email,))
            role_row = cursor.fetchone()
            role = role_row[0] if role_row else None
            
            if role == "organization":
                # extract new domain
                new_domain = new_value.strip().lower().split("@", 1)[1]
                cursor.execute(
                    """UPDATE users SET 
                        email = ?, 
                        domain = ?, 
                        credential_change_token = NULL, 
                        credential_change_expires = NULL, 
                        credential_change_type = NULL, 
                        pending_email = NULL, 
                        pending_password_hash = NULL 
                       WHERE email = ?""",
                    (new_value, new_domain, email)
                )
            else:
                cursor.execute(
                    """UPDATE users SET 
                        email = ?, 
                        credential_change_token = NULL, 
                        credential_change_expires = NULL, 
                        credential_change_type = NULL, 
                        pending_email = NULL, 
                        pending_password_hash = NULL 
                       WHERE email = ?""",
                    (new_value, email)
                )
        elif change_type == "password":
            cursor.execute(
                """UPDATE users SET 
                    password = ?, 
                    credential_change_token = NULL, 
                    credential_change_expires = NULL, 
                    credential_change_type = NULL, 
                    pending_email = NULL, 
                    pending_password_hash = NULL 
                   WHERE email = ?""",
                (new_value, email)
            )


# =========================
# UPDATE USER'S STORED DOMAIN (ORGANIZATIONAL ACCOUNTS)
# =========================
def update_user_domain(email, domain):
    """
    Updates ONLY the `domain` column for an existing user, identified by
    email. Called on successful organizational login to:
      - backfill the domain for accounts created before this column existed
      - keep the stored domain in sync with the account's email
    All other user fields (name, phone, password, role, app_password) are
    left completely untouched.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET domain = ? WHERE email = ?",
            (domain, email),
        )



# =========================
# CREATE SENDERS TABLE
# =========================
def create_senders_table():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS senders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT,
                organization_name TEXT,
                email TEXT,
                password TEXT
            )
        """)
        cursor.execute("PRAGMA table_info(senders)")
        cols = [row[1] for row in cursor.fetchall()]
        if "smtp_host" not in cols:
            cursor.execute("ALTER TABLE senders ADD COLUMN smtp_host TEXT DEFAULT 'smtp.gmail.com'")
            cursor.execute("ALTER TABLE senders ADD COLUMN smtp_port INTEGER DEFAULT 465")
            cursor.execute("ALTER TABLE senders ADD COLUMN smtp_use_tls INTEGER DEFAULT 1")
        if "smtp2go_api_key" not in cols:
            cursor.execute("ALTER TABLE senders ADD COLUMN smtp2go_api_key TEXT")
        if "verified" not in cols:
            cursor.execute("ALTER TABLE senders ADD COLUMN verified INTEGER DEFAULT 0")


# =========================
# ADD SENDER
# =========================
def add_sender(user_id, name, org_name, email, password, smtp_host=None, smtp_port=None, smtp_use_tls=None, smtp2go_api_key=None, verified=0):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO senders (user_id, name, organization_name, email, password, smtp_host, smtp_port, smtp_use_tls, smtp2go_api_key, verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, name, org_name, email, password, smtp_host, smtp_port, smtp_use_tls, smtp2go_api_key, verified))
        new_id = cursor.lastrowid
    # TEMP DIAGNOSTIC LOGGING — confirms the exact file the row was written
    # to and the row id SQLite assigned, immediately after commit.
    logger.info(
        "add_sender: inserted sender_id=%s user_id=%s email=%s into db_path=%s",
        new_id, user_id, email, os.path.abspath(DB_NAME),
    )


# =========================
# GET SENDERS
# =========================
def get_senders(user_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, organization_name, email, verified
            FROM senders WHERE user_id = ?
        """, (user_id,))
        rows = cursor.fetchall()

    # TEMP DIAGNOSTIC LOGGING — every time the sender list is read, log how
    # many rows came back and from which physical db file. If this count
    # drops to 0 for a user_id that previously had rows, compare the
    # db_path printed here against the one printed by add_sender for the
    # same account — if they differ, that's a path-mismatch bug; if they
    # match, the row was genuinely deleted (or the file was reset).
    logger.info(
        "get_senders: user_id=%s returned %d row(s) from db_path=%s",
        user_id, len(rows), os.path.abspath(DB_NAME),
    )

    return [
        {
            "id": r[0],
            "name": r[1],
            "organization_name": r[2],
            "email": r[3],
            "verified": bool(r[4]) if len(r) > 4 else False,
            "gmail_connected": is_gmail_connected(r[3]),
        }
        for r in rows
    ]


# =========================
# GET SINGLE SENDER
# =========================
def get_sender_by_id(sender_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM senders WHERE id = ?", (sender_id,))
        row = cursor.fetchone()

    if row:
        return {
            "id": row[0],
            "user_id": row[1],
            "name": row[2],
            "organization_name": row[3],
            "email": row[4],
            "password": row[5],
            "smtp_host": row[6] if len(row) > 6 else "smtp.gmail.com",
            "smtp_port": row[7] if len(row) > 7 else 465,
            "smtp_use_tls": bool(row[8]) if len(row) > 8 else True,
            "smtp2go_api_key": row[9] if len(row) > 9 else None,
            "verified": bool(row[10]) if len(row) > 10 else False,
        }
    return None


def get_sender_by_email(email):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM senders WHERE email = ?", (email.strip(),))
        row = cursor.fetchone()

    if row:
        return {
            "id": row[0],
            "user_id": row[1],
            "name": row[2],
            "organization_name": row[3],
            "email": row[4],
            "password": row[5],
            "smtp_host": row[6] if len(row) > 6 else "smtp.gmail.com",
            "smtp_port": row[7] if len(row) > 7 else 465,
            "smtp_use_tls": bool(row[8]) if len(row) > 8 else True,
            "smtp2go_api_key": row[9] if len(row) > 9 else None,
            "verified": bool(row[10]) if len(row) > 10 else False,
        }
    return None


# =========================
# GMAIL OAUTH TOKENS TABLE
# =========================
def create_gmail_tokens_table():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gmail_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT UNIQUE,
                refresh_token TEXT,
                access_token TEXT,
                token_expiry TEXT,
                connected_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)


def save_gmail_token(user_email: str, refresh_token: str, access_token: str = None, token_expiry=None):
    expiry_str = token_expiry.isoformat() if hasattr(token_expiry, "isoformat") else token_expiry

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT refresh_token FROM gmail_tokens WHERE user_email = ?", (user_email,))
        existing = cursor.fetchone()

        if existing:
            new_refresh = refresh_token or existing[0]
            cursor.execute("""
                UPDATE gmail_tokens
                SET refresh_token = ?, access_token = ?, token_expiry = ?
                WHERE user_email = ?
            """, (new_refresh, access_token, expiry_str, user_email))
            logger.info(
                "save_gmail_token: UPDATED existing token for %s in db_path=%s",
                user_email, os.path.abspath(DB_NAME),
            )
        else:
            cursor.execute("""
                INSERT INTO gmail_tokens (user_email, refresh_token, access_token, token_expiry)
                VALUES (?, ?, ?, ?)
            """, (user_email, refresh_token, access_token, expiry_str))
            logger.info(
                "save_gmail_token: INSERTED new token for %s in db_path=%s",
                user_email, os.path.abspath(DB_NAME),
            )


def get_gmail_token(user_email: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user_email, refresh_token, access_token, token_expiry, connected_at
            FROM gmail_tokens WHERE user_email = ?
        """, (user_email,))
        row = cursor.fetchone()

    if row:
        return {
            "user_email": row[0],
            "refresh_token": row[1],
            "access_token": row[2],
            "token_expiry": row[3],
            "connected_at": row[4],
        }
    return None


def update_gmail_access_token(user_email: str, access_token: str, token_expiry=None):
    expiry_str = token_expiry.isoformat() if hasattr(token_expiry, "isoformat") else token_expiry
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE gmail_tokens SET access_token = ?, token_expiry = ?
            WHERE user_email = ?
        """, (access_token, expiry_str, user_email))


def delete_gmail_token(user_email: str):
    # TEMP DIAGNOSTIC LOGGING — this is the ONLY code path in the entire
    # codebase that deletes from gmail_tokens. If Gmail connection ever
    # appears lost without the user explicitly disconnecting, this log line
    # tells you definitively whether this function was ever called.
    logger.warning(
        "delete_gmail_token: DELETING token for %s from db_path=%s",
        user_email, os.path.abspath(DB_NAME),
    )
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM gmail_tokens WHERE user_email = ?", (user_email,))


def is_gmail_connected(user_email: str) -> bool:
    return get_gmail_token(user_email) is not None


# =========================
# CREATE BATCHES TABLE
# =========================
def create_batches_table():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS batches (
                id TEXT PRIMARY KEY,
                owner_user_id INTEGER,
                sender_email TEXT,
                subject TEXT,
                total INTEGER,
                processed INTEGER,
                delivered INTEGER,
                failed INTEGER,
                skipped INTEGER,
                bounced INTEGER,
                status TEXT,
                created_at TEXT,
                results TEXT,
                bounced_emails TEXT
            )
        """)

def save_batch(batch_id, owner_user_id, sender_email, subject, total, processed, delivered, failed, skipped, bounced, status, created_at, results=None, bounced_emails=None):
    import json
    results_str = json.dumps(results) if results is not None else "[]"
    bounced_emails_str = json.dumps(bounced_emails) if bounced_emails is not None else "[]"
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO batches (id, owner_user_id, sender_email, subject, total, processed, delivered, failed, skipped, bounced, status, created_at, results, bounced_emails)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                processed=excluded.processed,
                delivered=excluded.delivered,
                failed=excluded.failed,
                skipped=excluded.skipped,
                bounced=excluded.bounced,
                status=excluded.status,
                results=excluded.results,
                bounced_emails=excluded.bounced_emails
        """, (batch_id, owner_user_id, sender_email, subject, total, processed, delivered, failed, skipped, bounced, status, created_at, results_str, bounced_emails_str))

def get_batches_by_user(owner_user_id):
    import json
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, owner_user_id, sender_email, subject, total, processed, delivered, failed, skipped, bounced, status, created_at, results, bounced_emails
            FROM batches WHERE owner_user_id = ? ORDER BY created_at DESC
        """, (owner_user_id,))
        rows = cursor.fetchall()
    
    batches = []
    for r in rows:
        try:
            results = json.loads(r[12])
        except Exception:
            results = []
        try:
            bounced_emails = json.loads(r[13])
        except Exception:
            bounced_emails = []
        batches.append({
            "job_id": r[0],
            "owner_user_id": r[1],
            "from_email": r[2],
            "subject": r[3],
            "total": r[4],
            "processed": r[5],
            "delivered": r[6],
            "failed": r[7],
            "skipped": r[8],
            "bounced": r[9],
            "status": r[10],
            "started_at": r[11],
            "completed_at": r[11] if r[10] != "in_progress" else None,
            "results": results,
            "bounced_emails": bounced_emails
        })
    return batches

# =========================
# CREATE USER CONSENT TABLE
# =========================
def create_user_consent_table():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_consent (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                has_accepted INTEGER NOT NULL DEFAULT 0,
                accepted_version TEXT NOT NULL DEFAULT 'v1.0',
                accepted_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_consent_user_id ON user_consent(user_id)")


def get_user_consent(user_id: int):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT has_accepted, accepted_version, accepted_at FROM user_consent WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
    if row:
        return {
            "has_accepted": bool(row[0]),
            "accepted_version": row[1],
            "accepted_at": row[2]
        }
    return {
        "has_accepted": False,
        "accepted_version": "v1.0",
        "accepted_at": None
    }


def save_user_consent(user_id: int, has_accepted: bool, accepted_version: str, accepted_at_iso: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_consent (user_id, has_accepted, accepted_version, accepted_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                has_accepted=excluded.has_accepted,
                accepted_version=excluded.accepted_version,
                accepted_at=excluded.accepted_at
        """, (user_id, 1 if has_accepted else 0, accepted_version, accepted_at_iso))


# =========================
# INIT ALL TABLES
# =========================
def setup_database():
    init_db()
    create_senders_table()
    create_gmail_tokens_table()
    create_batches_table()
    create_user_consent_table()



# =========================
# TEMP DIAGNOSTICS — sender persistence investigation
# =========================
# This function is purely read-only. It does not modify any data. It exists
# so we can prove, with hard evidence, whether senders are being deleted by
# application code or whether the underlying SQLite *file* itself is being
# reset/replaced (e.g. by an ephemeral filesystem on the host). Call
# GET /api/debug/db-status (added in main.py) before and after a
# "disappearance" event and compare:
#   - same `db_path`, same/growing `db_file_mtime`, but `senders_count` drops
#       -> a real delete is happening somewhere in the app (we've audited
#          every sender code path and found none, so this would point to
#          something outside the files reviewed, e.g. a process restarting
#          a *different* copy of the codebase).
#   - `db_file_mtime` resets to "just started" / `db_file_size_bytes` drops
#     back to a fresh-empty-db size right when sender data disappears
#       -> the SQLite file itself is being wiped/recreated, i.e. it is not
#          durably persisted across process restarts (ephemeral disk).
#          This is the most common cause of this exact symptom pattern on
#          platforms like Render without an attached persistent disk.
def get_db_diagnostics() -> dict:
    info: dict = {
        "db_path": os.path.abspath(DB_NAME),
        "db_file_exists": os.path.exists(DB_NAME),
    }
    try:
        stat = os.stat(DB_NAME)
        info["db_file_size_bytes"] = stat.st_size
        info["db_file_mtime"] = stat.st_mtime
    except OSError:
        info["db_file_size_bytes"] = None
        info["db_file_mtime"] = None

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM users")
            info["users_count"] = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM senders")
            info["senders_count"] = cursor.fetchone()[0]
            cursor.execute(
                "SELECT id, user_id, name, email FROM senders ORDER BY id"
            )
            info["senders_rows"] = [dict(r) for r in cursor.fetchall()]
            cursor.execute("SELECT COUNT(*) FROM gmail_tokens")
            info["gmail_tokens_count"] = cursor.fetchone()[0]
    except Exception as e:
        info["query_error"] = str(e)

    return info


setup_database()

# TEMP DIAGNOSTIC LOGGING — printed once per process start. If you see this
# line fire with a *different* db_path than before, or fire unexpectedly
# (i.e. you didn't expect a restart), that's direct evidence the backend
# process restarted — and on hosts without a persistent disk, a restart
# means the SQLite file area was reset, which would explain senders
# "disappearing" even though no application code deleted them.
logger.warning(
    "DATABASE MODULE LOADED — db_path=%s exists=%s size_bytes=%s",
    os.path.abspath(DB_NAME),
    os.path.exists(DB_NAME),
    os.path.getsize(DB_NAME) if os.path.exists(DB_NAME) else None,
)