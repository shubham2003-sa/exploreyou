"""Utility helpers for calling Supabase REST API asynchronously."""
import os
from typing import Any, Dict, Optional
from collections.abc import Iterable
from urllib.parse import quote

import httpx

_SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip() or None
# Get service role key or fallback to anon key, ensuring no whitespace
_service_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
_anon_key = (os.getenv("SUPABASE_ANON_KEY") or "").strip()
_SUPABASE_KEY = _service_key or _anon_key or None

if _SUPABASE_URL:
    _REST_BASE = _SUPABASE_URL.rstrip("/") + "/rest/v1"
else:
    _REST_BASE = None

_HEADERS: Optional[Dict[str, str]] = None
_client: Optional[httpx.AsyncClient] = None


def is_enabled() -> bool:
    """Return True when Supabase credentials are present."""
    return bool(_REST_BASE and _SUPABASE_KEY)


def _ensure_headers() -> Dict[str, str]:
    global _HEADERS
    if _HEADERS is None:
        if not is_enabled():
            raise RuntimeError("Supabase is not configured")
        if not _SUPABASE_KEY or not _SUPABASE_KEY.strip():
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is empty or contains only whitespace")
        _HEADERS = {
            "apikey": _SUPABASE_KEY.strip(),
            "Authorization": f"Bearer {_SUPABASE_KEY.strip()}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
    return _HEADERS


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        if not is_enabled():
            raise RuntimeError("Supabase is not configured")
        _client = httpx.AsyncClient(
            base_url=_REST_BASE,
            headers=_ensure_headers(),
            timeout=httpx.Timeout(15.0, read=15.0, write=15.0),
        )
    return _client


async def close_client() -> None:
    """Close the shared HTTP client."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _encode_filters(filters: Optional[Dict[str, Any]]) -> Dict[str, str]:
    params: Dict[str, str] = {}
    if not filters:
        return params
    for key, value in filters.items():
        if isinstance(value, Iterable) and not isinstance(value, (str, bytes, bytearray)):
            joined = ",".join(quote(str(v), safe="") for v in value)
            params[key] = f"in.({joined})"
        else:
            params[key] = f"eq.{quote(str(value), safe='')}"
    return params


async def request(
    method: str,
    path: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    json_body: Optional[Any] = None,
    headers: Optional[Dict[str, str]] = None,
) -> httpx.Response:
    client = await _get_client()
    merged_headers = _ensure_headers().copy()
    if headers:
        # Filter out any empty/whitespace-only header values to prevent httpx errors
        for key, value in headers.items():
            if value and value.strip():
                merged_headers[key] = value
    response = await client.request(method, path, params=params, json=json_body, headers=merged_headers)
    response.raise_for_status()
    return response


async def select(
    table: str,
    *,
    filters: Optional[Dict[str, Any]] = None,
    single: bool = False,
    limit: Optional[int] = None,
    order: Optional[str] = None,
    desc: bool = False,
) -> Any:
    params: Dict[str, Any] = {"select": "*"}
    params.update(_encode_filters(filters))
    if limit is not None:
        params["limit"] = str(limit)
    if order:
        params["order"] = f"{order}.{'desc' if desc else 'asc'}"
    response = await request("GET", f"/{table}", params=params)
    data = response.json()
    if single:
        return data[0] if data else None
    return data


async def insert(
    table: str,
    payload: Any,
    *,
    upsert: bool = False,
    on_conflict: Optional[str] = None,
    returning: bool = True,
) -> Any:
    prefer_parts = ["return=representation" if returning else "return=minimal"]
    if upsert:
        prefer_parts.append("resolution=merge-duplicates")
    headers = {"Prefer": ",".join(prefer_parts)}
    params: Dict[str, Any] = {}
    if upsert and on_conflict:
        params["on_conflict"] = on_conflict
    response = await request("POST", f"/{table}", params=params, json_body=payload, headers=headers)
    return response.json() if returning else None


async def update(
    table: str,
    filters: Dict[str, Any],
    values: Dict[str, Any],
    *,
    returning: bool = True,
) -> Any:
    prefer = "return=representation" if returning else "return=minimal"
    headers = {"Prefer": prefer}
    params = _encode_filters(filters)
    response = await request("PATCH", f"/{table}", params=params, json_body=values, headers=headers)
    return response.json() if returning else None


async def delete(table: str, filters: Dict[str, Any]) -> None:
    params = _encode_filters(filters)
    await request("DELETE", f"/{table}", params=params)

