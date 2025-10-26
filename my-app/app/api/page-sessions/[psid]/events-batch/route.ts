import { NextResponse, type NextRequest } from "next/server"

import {
  applyCookieUpdates,
  eventTimestampFromItem,
  makeSupabaseServer,
  parseJson,
} from "../../_utils"

export const runtime = "nodejs"

type EventPayload = {
  event_type?: unknown
  x?: unknown
  y?: unknown
  data?: unknown
  ts_ms?: unknown
  timestamp?: unknown
  event_timestamp?: unknown
}

export async function POST(request: NextRequest, { params }: { params: { psid: string } }) {
  const psid = params.psid
  if (!psid) {
    return NextResponse.json({ detail: "Missing page session id" }, { status: 400 })
  }

  try {
    const { supabase, cookieUpdates } = makeSupabaseServer(request)
    const body = (await parseJson(request)) as { events?: unknown }
    const rawEvents = Array.isArray(body.events) ? (body.events as EventPayload[]) : []

    if (!rawEvents.length) {
      const response = NextResponse.json({ inserted: 0 }, { status: 200 })
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    let clickIncrement = 0
    let latestTimestamp = new Date(0)

    const sanitized = rawEvents
      .map((item) => {
        if (!item || typeof item.event_type !== "string") {
          return null
        }
        const ts = eventTimestampFromItem(item as Record<string, unknown>)
        if (ts > latestTimestamp) {
          latestTimestamp = ts
        }
        if (item.event_type === "click") {
          clickIncrement += 1
        }
        const payload: Record<string, unknown> = {
          page_session_id: psid,
          event_type: item.event_type,
          event_timestamp: ts.toISOString(),
        }
        if (typeof item.x === "number" && Number.isFinite(item.x)) {
          payload.x = Math.round(item.x)
        }
        if (typeof item.y === "number" && Number.isFinite(item.y)) {
          payload.y = Math.round(item.y)
        }
        if (item.data != null) {
          try {
            payload.data = JSON.stringify(item.data)
          } catch {
            payload.data = JSON.stringify({ value: String(item.data) })
          }
        }
        return payload
      })
      .filter((item): item is Record<string, unknown> => Boolean(item))

    if (!sanitized.length) {
      const response = NextResponse.json({ inserted: 0 }, { status: 200 })
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    const { error: insertError } = await supabase.from("events").insert(sanitized)
    if (insertError) {
      const response = NextResponse.json(
        { detail: insertError.message || "Failed to record events" },
        { status: 500 },
      )
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    const { data: session, error: sessionError } = await supabase
      .from("page_sessions")
      .select("event_count, click_count")
      .eq("id", psid)
      .maybeSingle()

    if (sessionError) {
      const response = NextResponse.json(
        { detail: sessionError.message || "Failed to load session" },
        { status: 500 },
      )
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    if (!session) {
      const response = NextResponse.json({ detail: "Page session not found" }, { status: 404 })
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    const currentEvents = Number(session.event_count ?? 0)
    const currentClicks = Number(session.click_count ?? 0)
    const updates = {
      event_count: currentEvents + sanitized.length,
      click_count: currentClicks + clickIncrement,
      last_event_at: (latestTimestamp.getTime() > 0 ? latestTimestamp : new Date()).toISOString(),
    }

    const { error: updateError } = await supabase
      .from("page_sessions")
      .update(updates)
      .eq("id", psid)

    if (updateError) {
      const response = NextResponse.json(
        { detail: updateError.message || "Failed to update session counters" },
        { status: 500 },
      )
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

    const response = NextResponse.json({ inserted: sanitized.length }, { status: 200 })
    applyCookieUpdates(response, cookieUpdates)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
