"""Supabase data helpers used by FastAPI endpoints."""
from __future__ import annotations
import json

from datetime import datetime, timedelta, timezone
from uuid import uuid4
from typing import Any, Dict, List, Optional, Sequence

from supabase_client import delete as sb_delete
from supabase_client import insert as sb_insert
from supabase_client import select as sb_select
from supabase_client import update as sb_update

UTC = timezone.utc

def _utc_now() -> datetime:
    return datetime.now(tz=UTC)


def _serialize_dt(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat()


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        cleaned = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(cleaned)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)
    except ValueError:
        return None


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    if not email:
        return None
    return await sb_select("users", filters={"email": email}, single=True)


async def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    return await sb_select("users", filters={"id": user_id}, single=True)


async def create_user(name: str, email: str, password_hash: str) -> Dict[str, Any]:
    payload = {
        "name": name,
        "email": email,
        "password_hash": password_hash,
    }
    rows = await sb_insert("users", payload)
    if not rows:
        raise RuntimeError("Failed to insert user")
    return rows[0]


async def update_user(email: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    rows = await sb_update("users", filters={"email": email}, values=fields)
    if rows:
        return rows[0]
    return None


async def delete_user(email: str) -> None:
    await sb_delete("users", filters={"email": email})


async def list_users() -> List[Dict[str, Any]]:
    rows = await sb_select("users", order="id")
    return list(rows)


async def create_session(user_id: Optional[int], lifetime_minutes: int) -> Dict[str, Any]:
    session_id = str(uuid4())
    now = _utc_now()
    expires = now + timedelta(minutes=lifetime_minutes) if user_id is not None else None
    payload = {
        "id": session_id,
        "user_id": user_id,
        "created_at": _serialize_dt(now),
        "expires_at": _serialize_dt(expires),
    }
    await sb_insert("sessions", payload, returning=False)
    payload["expires_at"] = expires
    payload["created_at"] = now
    return payload


async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    record = await sb_select("sessions", filters={"id": session_id}, single=True)
    if record:
        record["created_at"] = _parse_dt(record.get("created_at"))
        record["expires_at"] = _parse_dt(record.get("expires_at"))
    return record


async def delete_session(session_id: str) -> None:
    await sb_delete("sessions", filters={"id": session_id})


async def create_page_session(psid: str, *, user_session_id: Optional[str], user_id: Optional[int], page: Optional[str]) -> None:
    now = _utc_now()
    payload = {
        "id": psid,
        "user_session_id": user_session_id,
        "user_id": user_id,
        "page": page,
        "created_at": _serialize_dt(now),
    }
    await sb_insert("page_sessions", payload, returning=False)


async def get_page_session(psid: str) -> Optional[Dict[str, Any]]:
    record = await sb_select("page_sessions", filters={"id": psid}, single=True)
    if record:
        for key in ("created_at", "ended_at", "last_event_at"):
            record[key] = _parse_dt(record.get(key))
    return record


async def update_page_session(psid: str, values: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    processed: Dict[str, Any] = {}
    for key, value in values.items():
        if key in {"created_at", "ended_at", "last_event_at"}:
            processed[key] = _serialize_dt(value)
        else:
            processed[key] = value
    rows = await sb_update("page_sessions", filters={"id": psid}, values=processed)
    if rows:
        return rows[0]
    return None


async def insert_events(events: Sequence[Dict[str, Any]]) -> None:
    if not events:
        return
    payload = []
    for evt in events:
        data = dict(evt)
        for key in ("event_timestamp",):
            data[key] = _serialize_dt(data[key])
        payload.append(data)
    await sb_insert("events", payload, returning=False)


async def upsert_cursor_dwell(records: Sequence[Dict[str, Any]]) -> None:
    if not records:
        return
    payload = []
    for rec in records:
        data = dict(rec)
        for key in ("first_seen", "last_updated"):
            if key in data:
                data[key] = _serialize_dt(data[key])
        if "extra_metadata" in data and data["extra_metadata"] is not None:
            data["extra_metadata"] = json.dumps(data["extra_metadata"])
        payload.append(data)
    await sb_insert(
        "cursor_dwell_metrics",
        payload,
        upsert=True,
        on_conflict="page_session_id,target_key",
        returning=False,
    )


async def update_cursor_dwell_filters(psid: str, target_key: str, values: Dict[str, Any]) -> None:
    processed = {}
    for key, value in values.items():
        if key in ("first_seen", "last_updated"):
            processed[key] = _serialize_dt(value)
        elif key == "extra_metadata":
            if value is None:
                processed[key] = None
            elif isinstance(value, str):
                processed[key] = value
            else:
                processed[key] = json.dumps(value)
        else:
            processed[key] = value
    await sb_update(
        "cursor_dwell_metrics",
        filters={"page_session_id": psid, "target_key": target_key},
        values=processed,
        returning=False,
    )


async def fetch_cursor_dwell(psid: str, target_keys: Sequence[str]) -> List[Dict[str, Any]]:
    if not target_keys:
        return []
    rows = await sb_select(
        "cursor_dwell_metrics",
        filters={"page_session_id": psid, "target_key": target_keys},
    )
    result: List[Dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        for key in ("first_seen", "last_updated"):
            item[key] = _parse_dt(item.get(key))
        meta = item.get("extra_metadata")
        if isinstance(meta, str):
            try:
                item["extra_metadata"] = json.loads(meta)
            except json.JSONDecodeError:
                pass
        result.append(item)
    return result


async def upsert_video_progress(record: Dict[str, Any]) -> Dict[str, Any]:
    payload = dict(record)
    for key in ("last_event_at", "created_at", "updated_at"):
        payload[key] = _serialize_dt(payload.get(key))
    rows = await sb_insert(
        "video_progress",
        payload,
        upsert=True,
        on_conflict="user_id,video_id",
    )
    if not rows:
        raise RuntimeError("Video progress upsert returned no rows")
    result = rows[0]
    for key in ("last_event_at", "created_at", "updated_at"):
        result[key] = _parse_dt(result.get(key))
    return result


async def list_video_progress(filters: Dict[str, Any], limit: int) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {k: v for k, v in filters.items() if v is not None}
    rows = await sb_select(
        "video_progress",
        filters=params,
        limit=limit,
        order="updated_at",
        desc=True,
    )
    result: List[Dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        for key in ("last_event_at", "created_at", "updated_at"):
            item[key] = _parse_dt(item.get(key))
        result.append(item)
    return result


async def get_user_score(user_id: str) -> Optional[Dict[str, Any]]:
    record = await sb_select("user_scores", filters={"user_id": user_id}, single=True)
    if record:
        record["updated_at"] = _parse_dt(record.get("updated_at"))
    return record


async def upsert_user_score(user_id: str, email: Optional[str], total_points: float, total_possible: float) -> Dict[str, Any]:
    payload = {
        "user_id": user_id,
        "user_email": email,
        "total_points": total_points,
        "total_possible": total_possible,
        "updated_at": _serialize_dt(_utc_now()),
    }
    rows = await sb_insert(
        "user_scores",
        payload,
        upsert=True,
        on_conflict="user_id",
    )
    if not rows:
        raise RuntimeError("Failed to upsert user score")
    record = rows[0]
    record["updated_at"] = _parse_dt(record.get("updated_at"))
    return record


async def end_page_session(psid: str, values: Dict[str, Any]) -> None:
    processed = {}
    for key, value in values.items():
        if key in ("created_at", "ended_at", "last_event_at"):
            processed[key] = _serialize_dt(value)
        else:
            processed[key] = value
    await sb_update("page_sessions", filters={"id": psid}, values=processed, returning=False)




