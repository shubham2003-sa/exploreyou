"""FastAPI backend for exploreyou project using Supabase as the datastore."""

import json
import os
import uuid
from datetime import datetime, timedelta
import datetime as _dt
from types import SimpleNamespace
from typing import Dict, List, Optional, Sequence, Tuple

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

from passlib.context import CryptContext

from supabase_client import close_client as close_supabase_client, is_enabled as supabase_enabled
import supabase_repo as sb_repo

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
VIDEOS_FILE = os.path.join(DATA_DIR, "videos.json")
TEXTS_FILE = os.path.join(DATA_DIR, "texts.json")

if not supabase_enabled():
    raise RuntimeError("Supabase credentials are required to run the backend")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class Video(BaseModel):
    id: int
    title: str
    description: str
    file_url: str


class Text(BaseModel):
    id: int
    title: str
    content: str


class StartSessionRequest(BaseModel):
    page: Optional[str] = None


class StartSessionResponse(BaseModel):
    id: str


class EventRequest(BaseModel):
    event_type: str
    x: Optional[int] = None
    y: Optional[int] = None
    data: Optional[dict] = None
    timestamp: Optional[datetime] = None
    ts_ms: Optional[int] = None


class EventItem(BaseModel):
    event_type: str
    x: Optional[int] = None
    y: Optional[int] = None
    data: Optional[dict] = None
    timestamp: Optional[datetime] = None
    ts_ms: Optional[int] = None


class EventBatchRequest(BaseModel):
    events: List[EventItem]


class EndSessionRequest(BaseModel):
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None


class CursorDwellItem(BaseModel):
    target_key: str
    duration_ms: int = Field(ge=0)
    entry_count: Optional[int] = Field(default=0, ge=0)
    label: Optional[str] = None
    center_x: Optional[int] = None
    center_y: Optional[int] = None
    radius: Optional[int] = None
    metadata: Optional[dict] = None


class CursorDwellBatchRequest(BaseModel):
    items: List[CursorDwellItem]


class ScoreEventRequest(BaseModel):
    points_earned: float = Field(ge=0.0)
    points_possible: float = Field(ge=0.0)
    source: Optional[str] = None
    user_email: Optional[str] = None


class ScoreSummaryResponse(BaseModel):
    total_points: float
    total_possible: float
    score_percent: float


class VideoProgressRequest(BaseModel):
    user_id: str
    video_id: str
    video_url: Optional[str] = None
    progress: float = Field(ge=0.0, le=1.0)
    position_seconds: float = Field(ge=0.0)
    duration_seconds: Optional[float] = Field(default=None, ge=0.0)
    stream_selected: Optional[str] = None
    task_status: Optional[str] = None
    event_name: Optional[str] = None
    event_timestamp: Optional[datetime] = None
    user_email: Optional[str] = None


class VideoProgressResponse(BaseModel):
    id: str
    user_id: str
    user_email: Optional[str] = None
    video_id: str
    video_url: Optional[str] = None
    progress: float
    position_seconds: float
    duration_seconds: Optional[float] = None
    stream_selected: Optional[str] = None
    task_status: Optional[str] = None
    event_name: Optional[str] = None
    last_event_at: datetime
    updated_at: datetime
    created_at: datetime


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await close_supabase_client()


def read_json(path: str) -> List[Dict[str, object]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"Corrupted data file: {exc}")


def write_json(path: str, payload: List[Dict[str, object]]) -> None:
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to persist data: {exc}")


def hash_password(password: str) -> str:
    return pwd_context.hash(password[:72])


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _to_naive_utc(dt: Optional[_dt.datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(_dt.timezone.utc).replace(tzinfo=None)
    return dt


def _calculate_session_score(click_count: int, event_count: int, duration_seconds: int | None) -> float:
    clicks = max(click_count, 0)
    events = max(event_count, 0)
    duration = max(duration_seconds or 0, 0)
    duration_component = min(duration, 3600) / 12.0
    return clicks * 3.0 + events * 1.5 + duration_component


def _score_response(record: Optional[Dict[str, object]]) -> ScoreSummaryResponse:
    if not record:
        return ScoreSummaryResponse(total_points=0.0, total_possible=0.0, score_percent=0.0)
    total_points = float(record.get("total_points") or 0.0)
    total_possible = float(record.get("total_possible") or 0.0)
    percent = (total_points / total_possible * 100.0) if total_possible > 0 else 0.0
    return ScoreSummaryResponse(total_points=total_points, total_possible=total_possible, score_percent=percent)


def _public_user(record: Dict[str, object]) -> Dict[str, object]:
    return {"id": record.get("id"), "name": record.get("name"), "email": record.get("email")}


def _video_progress_response(record: Dict[str, object]) -> VideoProgressResponse:
    return VideoProgressResponse(
        id=record["id"],
        user_id=record["user_id"],
        user_email=record.get("user_email"),
        video_id=record["video_id"],
        video_url=record.get("video_url"),
        progress=float(record.get("progress", 0.0)),
        position_seconds=float(record.get("position_seconds", 0.0)),
        duration_seconds=(float(record["duration_seconds"]) if record.get("duration_seconds") is not None else None),
        stream_selected=record.get("stream_selected"),
        task_status=record.get("task_status"),
        event_name=record.get("event_name"),
        last_event_at=record.get("last_event_at"),
        updated_at=record.get("updated_at"),
        created_at=record.get("created_at"),
    )


async def create_session(user_id: Optional[int], lifetime_minutes: int = 60 * 24 * 7) -> str:
    record = await sb_repo.create_session(user_id, lifetime_minutes)
    return record["id"]


async def get_user_by_session(session_id: Optional[str]) -> Optional[SimpleNamespace]:
    if not session_id:
        return None
    session = await sb_repo.get_session(session_id)
    if not session:
        return None
    expires_at = session.get("expires_at")
    if isinstance(expires_at, datetime) and expires_at.replace(tzinfo=None) < datetime.utcnow():
        return None
    user_id = session.get("user_id")
    if user_id is None:
        return None
    user_record = await sb_repo.get_user_by_id(user_id)
    if not user_record:
        return None
    return SimpleNamespace(**user_record)


async def _resolve_score_identity(request: Request, fallback_email: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    sid_cookie = request.cookies.get("session_id")
    user = await get_user_by_session(sid_cookie)
    email = fallback_email or None
    user_id: Optional[str] = None
    if user:
        user_id = f"user:{user.id}"
        if getattr(user, "email", None):
            email = email or user.email
    if not user_id and email:
        user_id = f"email:{email.lower()}"
    return user_id, email


@app.post("/register")
async def register(payload: RegisterRequest):
    if not payload.name or not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Missing registration fields")
    existing = await sb_repo.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    user_record = await sb_repo.create_user(payload.name, payload.email, hash_password(payload.password))
    return _public_user(user_record)


@app.post("/login")
async def login(request: Request, response: Response, payload: LoginRequest):
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Missing credentials")
    user_record = await sb_repo.get_user_by_email(payload.email)
    if not user_record or not verify_password(payload.password, user_record["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    sid = await create_session(user_record["id"])
    response.set_cookie(key="session_id", value=sid, httponly=True, samesite="lax", secure=False, path="/")
    return _public_user(user_record)


@app.post("/logout")
async def logout(request: Request, response: Response):
    sid = request.cookies.get("session_id")
    if sid:
        await sb_repo.delete_session(sid)
    new_sid = await create_session(None)
    response.set_cookie(key="session_id", value=new_sid, httponly=True, samesite="lax", secure=False, path="/")
    return JSONResponse({"detail": "Logged out"})


@app.get("/me")
async def me(request: Request):
    sid = request.cookies.get("session_id")
    user = await get_user_by_session(sid)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return _public_user(user.__dict__)


@app.get("/users_db")
async def get_users_db():
    records = await sb_repo.list_users()
    return [_public_user(rec) for rec in records]


@app.put("/users_db/{email}")
async def update_user_db(email: str, payload: Dict[str, object]):
    updates: Dict[str, object] = {}
    if "name" in payload:
        updates["name"] = payload["name"]
    if "password" in payload:
        updates["password_hash"] = hash_password(str(payload["password"]))
    if not updates:
        raise HTTPException(status_code=400, detail="No supported fields provided")
    result = await sb_repo.update_user(email, updates)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return _public_user(result)


@app.delete("/users_db/{email}")
async def delete_user_db(email: str):
    existing = await sb_repo.get_user_by_email(email)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    await sb_repo.delete_user(email)
    return {"detail": "User deleted."}


@app.get("/videos", response_model=List[Video])
def get_videos():
    return read_json(VIDEOS_FILE)


@app.post("/videos", response_model=Video)
def add_video(video: Video):
    videos = read_json(VIDEOS_FILE)
    if any(v.get("id") == video.id for v in videos):
        raise HTTPException(status_code=400, detail="Video with this ID already exists.")
    videos.append(video.dict())
    write_json(VIDEOS_FILE, videos)
    return video


@app.put("/videos/{video_id}", response_model=Video)
def update_video(video_id: int, video: Video):
    videos = read_json(VIDEOS_FILE)
    for idx, existing in enumerate(videos):
        if existing.get("id") == video_id:
            videos[idx] = video.dict()
            write_json(VIDEOS_FILE, videos)
            return video
    raise HTTPException(status_code=404, detail="Video not found.")


@app.delete("/videos/{video_id}")
def delete_video(video_id: int):
    videos = read_json(VIDEOS_FILE)
    updated = [v for v in videos if v.get("id") != video_id]
    if len(updated) == len(videos):
        raise HTTPException(status_code=404, detail="Video not found.")
    write_json(VIDEOS_FILE, updated)
    return {"detail": "Video deleted."}


@app.get("/texts", response_model=List[Text])
def get_texts():
    return read_json(TEXTS_FILE)


@app.post("/texts", response_model=Text)
def add_text(text: Text):
    texts = read_json(TEXTS_FILE)
    if any(t.get("id") == text.id for t in texts):
        raise HTTPException(status_code=400, detail="Text with this ID already exists.")
    texts.append(text.dict())
    write_json(TEXTS_FILE, texts)
    return text


@app.put("/texts/{text_id}", response_model=Text)
def update_text(text_id: int, text: Text):
    texts = read_json(TEXTS_FILE)
    for idx, existing in enumerate(texts):
        if existing.get("id") == text_id:
            texts[idx] = text.dict()
            write_json(TEXTS_FILE, texts)
            return text
    raise HTTPException(status_code=404, detail="Text not found.")


@app.delete("/texts/{text_id}")
def delete_text(text_id: int):
    texts = read_json(TEXTS_FILE)
    updated = [t for t in texts if t.get("id") != text_id]
    if len(updated) == len(texts):
        raise HTTPException(status_code=404, detail="Text not found.")
    write_json(TEXTS_FILE, updated)
    return {"detail": "Text deleted."}


@app.post("/page-sessions/start", response_model=StartSessionResponse)
async def start_page_session(request: Request, payload: StartSessionRequest):
    sid_cookie = request.cookies.get("session_id")
    user = await get_user_by_session(sid_cookie)
    psid = str(uuid.uuid4())
    await sb_repo.create_page_session(psid, user_session_id=sid_cookie, user_id=(user.id if user else None), page=payload.page)
    return StartSessionResponse(id=psid)


def _build_event_timestamp(item: EventRequest | EventItem) -> datetime:
    if item.ts_ms is not None:
        return datetime.utcfromtimestamp(item.ts_ms / 1000.0)
    return _to_naive_utc(item.timestamp) or datetime.utcnow()


@app.post("/page-sessions/{psid}/event")
async def record_event(psid: str, payload: EventRequest):
    ts = _build_event_timestamp(payload)
    event = {
        "page_session_id": psid,
        "event_type": payload.event_type,
        "event_timestamp": ts,
        "data": json.dumps(payload.data) if payload.data is not None else None,
        "x": payload.x,
        "y": payload.y,
    }
    await sb_repo.insert_events([event])
    session = await sb_repo.get_page_session(psid)
    if not session:
        raise HTTPException(status_code=404, detail="Page session not found")
    updates = {
        "event_count": int(session.get("event_count") or 0) + 1,
        "last_event_at": ts,
    }
    if payload.event_type == "click":
        updates["click_count"] = int(session.get("click_count") or 0) + 1
    await sb_repo.update_page_session(psid, updates)
    return {"detail": "event recorded"}


@app.post("/page-sessions/{psid}/events-batch")
async def record_events_batch(psid: str, payload: EventBatchRequest):
    items = payload.events or []
    if not items:
        return {"inserted": 0}
    events = []
    click_increment = 0
    latest_ts = datetime.utcnow()
    for item in items:
        ts = _build_event_timestamp(item)
        latest_ts = max(latest_ts, ts)
        if item.event_type == "click":
            click_increment += 1
        events.append(
            {
                "page_session_id": psid,
                "event_type": item.event_type,
                "event_timestamp": ts,
                "data": json.dumps(item.data) if item.data is not None else None,
                "x": item.x,
                "y": item.y,
            }
        )
    await sb_repo.insert_events(events)
    session = await sb_repo.get_page_session(psid)
    if not session:
        raise HTTPException(status_code=404, detail="Page session not found")
    updates = {
        "event_count": int(session.get("event_count") or 0) + len(events),
        "click_count": int(session.get("click_count") or 0) + click_increment,
        "last_event_at": latest_ts,
    }
    await sb_repo.update_page_session(psid, updates)
    return {"inserted": len(events)}


@app.post("/page-sessions/{psid}/cursor-dwell")
async def record_cursor_dwell(psid: str, request: Request, payload: CursorDwellBatchRequest):
    items = payload.items or []
    normalized = [item for item in items if item.duration_ms > 0 or (item.entry_count or 0) > 0]
    if not normalized:
        return {"updated": 0}
    sid_cookie = request.cookies.get("session_id")
    user = await get_user_by_session(sid_cookie)
    session = await sb_repo.get_page_session(psid)
    if not session:
        raise HTTPException(status_code=404, detail="Page session not found")
    session_updates: Dict[str, object] = {}
    if session.get("user_session_id"):
        if not sid_cookie or session["user_session_id"] != sid_cookie:
            raise HTTPException(status_code=403, detail="Page session does not belong to this client")
    elif sid_cookie:
        session_updates["user_session_id"] = sid_cookie
    if session.get("user_id") is None and user:
        session_updates["user_id"] = user.id
    target_keys = [item.target_key for item in normalized]
    existing = await sb_repo.fetch_cursor_dwell(psid, target_keys)
    existing_map = {row["target_key"]: row for row in existing}
    now = datetime.utcnow()
    duration_total = 0
    entry_total = 0
    upserts: List[Dict[str, object]] = []
    for item in normalized:
        prev = existing_map.get(item.target_key, {})
        total_duration = int(prev.get("total_duration_ms") or 0) + int(item.duration_ms)
        total_entries = int(prev.get("total_entries") or 0) + int(item.entry_count or 0)
        duration_total += int(item.duration_ms)
        entry_total += int(item.entry_count or 0)
        first_seen = prev.get("first_seen") or now
        record = {
            "page_session_id": psid,
            "target_key": item.target_key,
            "target_label": item.label if item.label is not None else prev.get("target_label"),
            "center_x": item.center_x if item.center_x is not None else prev.get("center_x"),
            "center_y": item.center_y if item.center_y is not None else prev.get("center_y"),
            "radius": item.radius if item.radius is not None else prev.get("radius"),
            "extra_metadata": item.metadata if item.metadata is not None else prev.get("extra_metadata"),
            "total_duration_ms": total_duration,
            "total_entries": total_entries,
            "first_seen": first_seen,
            "last_updated": now,
        }
        upserts.append(record)
    await sb_repo.upsert_cursor_dwell(upserts)
    if duration_total or entry_total:
        session_updates["last_event_at"] = now
        session_updates["event_count"] = int(session.get("event_count") or 0) + entry_total
    if session_updates:
        await sb_repo.update_page_session(psid, session_updates)
    return {"updated": len(upserts)}


@app.post("/page-sessions/{psid}/end")
async def end_page_session(psid: str, payload: EndSessionRequest):
    ended_at = _to_naive_utc(payload.ended_at) or datetime.utcnow()
    session = await sb_repo.get_page_session(psid)
    if not session:
        raise HTTPException(status_code=404, detail="Page session not found")
    duration = payload.duration_seconds
    if duration is None and session.get("created_at"):
        duration = int((ended_at - session["created_at"]).total_seconds())
    updates = {
        "ended_at": ended_at,
        "duration_seconds": duration,
        "last_event_at": session.get("last_event_at") or ended_at,
        "score": _calculate_session_score(int(session.get("click_count") or 0), int(session.get("event_count") or 0), duration),
    }
    await sb_repo.end_page_session(psid, updates)
    return {"detail": "session ended"}


@app.post("/video-progress", response_model=VideoProgressResponse)
async def upsert_video_progress(payload: VideoProgressRequest):
    event_time = _to_naive_utc(payload.event_timestamp) or datetime.utcnow()
    record = {
        "id": str(uuid.uuid4()),
        "user_id": payload.user_id,
        "user_email": payload.user_email,
        "video_id": payload.video_id,
        "video_url": payload.video_url,
        "progress": max(0.0, min(1.0, payload.progress)),
        "position_seconds": max(0.0, payload.position_seconds),
        "duration_seconds": payload.duration_seconds,
        "stream_selected": payload.stream_selected,
        "task_status": payload.task_status,
        "event_name": payload.event_name,
        "last_event_at": event_time,
        "updated_at": event_time,
    }
    existing = await sb_repo.list_video_progress({"user_id": payload.user_id, "video_id": payload.video_id}, limit=1)
    if existing:
        record["id"] = existing[0]["id"]
        record["created_at"] = existing[0].get("created_at")
    result = await sb_repo.upsert_video_progress(record)
    return _video_progress_response(result)


@app.get("/video-progress", response_model=List[VideoProgressResponse])
async def list_video_progress(user_id: Optional[str] = None, user_email: Optional[str] = None, video_id: Optional[str] = None, limit: int = 20):
    if not user_id and not user_email:
        raise HTTPException(status_code=400, detail="user_id or user_email must be provided")
    limit = max(1, min(limit, 100))
    records = await sb_repo.list_video_progress({"user_id": user_id, "user_email": user_email, "video_id": video_id}, limit=limit)
    return [_video_progress_response(record) for record in records]


@app.get("/scores/me", response_model=ScoreSummaryResponse)
async def get_my_score(request: Request, user_email: Optional[str] = None):
    user_id, email = await _resolve_score_identity(request, user_email)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unable to resolve user for score lookup")
    record = await sb_repo.get_user_score(user_id)
    return _score_response(record)


@app.post("/scores/events", response_model=ScoreSummaryResponse)
async def record_score_event(request: Request, payload: ScoreEventRequest):
    user_id, email = await _resolve_score_identity(request, payload.user_email)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unable to resolve user for score update")
    points = max(payload.points_earned, 0.0)
    possible = max(payload.points_possible, 0.0) or points
    current = await sb_repo.get_user_score(user_id)
    total_points = float(current.get("total_points") or 0.0) + points if current else points
    total_possible = float(current.get("total_possible") or 0.0) + possible if current else possible
    record = await sb_repo.upsert_user_score(user_id, email, total_points, total_possible)
    return _score_response(record)
