"""
Gmail API sending service (Approach B).

Uses a user's stored refresh token to obtain a fresh access token and
send email via the Gmail API (messages.send), instead of raw SMTP.
"""

import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from app.auth_google import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SCOPES
from app.database import get_gmail_token, update_gmail_access_token


def _build_credentials(user_email: str) -> Credentials:
    token_row = get_gmail_token(user_email)
    if not token_row:
        raise ValueError(f"No Gmail account connected for {user_email}")

    creds = Credentials(
        token=token_row.get("access_token"),
        refresh_token=token_row["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )

    # Refresh if expired / no access token cached
    if not creds.valid:
        creds.refresh(Request())
        update_gmail_access_token(user_email, creds.token, creds.expiry)

    return creds


def _build_message(sender: str, to: str, subject: str, body: str, html: bool = False) -> dict:
    message = MIMEMultipart("alternative")
    message["to"] = to
    message["from"] = sender
    message["subject"] = subject

    mime_type = "html" if html else "plain"
    message.attach(MIMEText(body, mime_type))

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return {"raw": raw}


def send_email_gmail(user_email: str, to_email: str, subject: str, body: str, html: bool = False) -> dict:
    """
    Send an email via the Gmail API using the stored refresh token
    for `user_email` (the logged-in user's connected Gmail account).
    """
    creds = _build_credentials(user_email)
    service = build("gmail", "v1", credentials=creds)

    message = _build_message(user_email, to_email, subject, body, html=html)
    result = service.users().messages().send(userId="me", body=message).execute()
    return result


def check_bounces_gmail(user_email: str) -> list[dict]:
    """
    Check Gmail inbox/spam for bounce messages sent to user_email in the last 30 minutes.
    """
    import re
    import time
    from datetime import datetime, timezone

    bounced = []
    try:
        creds = _build_credentials(user_email)
        service = build("gmail", "v1", credentials=creds)

        # Search for bounce messages from mailer-daemon, postmaster, or with undelivered subjects
        query = 'from:mailer-daemon OR from:postmaster OR subject:"delivery status" OR subject:undelivered'
        results = service.users().messages().list(userId="me", q=query, maxResults=20).execute()
        messages = results.get("messages", [])

        cutoff_ms = int((time.time() - 30 * 60) * 1000)  # last 30 minutes

        for m in messages:
            msg = service.users().messages().get(userId="me", id=m["id"], format="full").execute()
            internal_date = int(msg.get("internalDate", 0))
            if internal_date < cutoff_ms:
                continue

            payload = msg.get("payload", {})
            headers = payload.get("headers", [])

            subject = next((h["value"] for h in headers if h["name"].lower() == "subject"), "Bounce notification")
            sender = next((h["value"] for h in headers if h["name"].lower() == "from"), "mailer-daemon")

            # Extract email body recursively to handle nested multi-part structures
            def get_text_recursive(part) -> str:
                mime = part.get("mimeType", "")
                data = part.get("body", {}).get("data", "")
                text_content = ""
                if data:
                    try:
                        text_content += base64.urlsafe_b64decode(data.encode()).decode(errors="ignore")
                    except Exception:
                        pass
                if "parts" in part:
                    for p in part["parts"]:
                        text_content += "\n" + get_text_recursive(p)
                return text_content

            body = get_text_recursive(payload)

            # Extract failed email from body
            email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", body)
            failed_email = email_match.group(0) if email_match else None

            if failed_email and failed_email.lower().strip() != user_email.lower().strip():
                failed_email_clean = failed_email.lower().strip()
                if not any(b["email"] == failed_email_clean for b in bounced):
                    dt = datetime.fromtimestamp(internal_date / 1000.0, timezone.utc)
                    bounced.append({
                        "email": failed_email_clean,
                        "reason": subject,
                        "folder": "Gmail API Search",
                        "date": dt.isoformat()
                    })

    except Exception as e:
        print(f"Error checking bounces via Gmail API: {e}")

    return bounced