import { randomUUID } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"

import {
  applyCookieUpdates,
  ensureClientSessionId,
  isUniqueConstraintError,
  makeSupabaseServer,
  parseJson,
  setClientSessionId,
} from "../_utils"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const { supabase, cookieUpdates } = makeSupabaseServer(request)
    const clientSessionId = ensureClientSessionId(request, cookieUpdates)
    const body = (await parseJson(request)) as { page?: unknown }
    const page = typeof body?.page === "string" ? body.page.slice(0, 512) : null

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user ?? null

    const psid = randomUUID()
    const nowIso = new Date().toISOString()

    const insertPayload: Record<string, unknown> = {
      id: psid,
      page,
      created_at: nowIso,
      last_event_at: nowIso,
      event_count: 0,
      click_count: 0,
    }

    if (user?.id) {
      insertPayload.user_id = user.id
    }
    if (user?.email) {
      insertPayload.user_email = user.email
    }

    const sessionCandidates: Array<{ value: string; shouldUpdateCookie: boolean }> = [
      { value: clientSessionId, shouldUpdateCookie: false },
      { value: randomUUID(), shouldUpdateCookie: true },
    ]

    for (const candidate of sessionCandidates) {
      const payload = { ...insertPayload, user_session_id: candidate.value }
      const { error } = await supabase.from("page_sessions").insert(payload)
      if (!error) {
        if (candidate.shouldUpdateCookie) {
          setClientSessionId(cookieUpdates, candidate.value)
        }
        const response = NextResponse.json({ id: psid }, { status: 201 })
        applyCookieUpdates(response, cookieUpdates)
        return response
      }
      if (!isUniqueConstraintError(error)) {
        const response = NextResponse.json(
          { detail: error.message || "Failed to start page session" },
          { status: 500 },
        )
        applyCookieUpdates(response, cookieUpdates)
        return response
      }
    }

    {
      const response = NextResponse.json(
        { detail: "Failed to start page session" },
        { status: 500 },
      )
      applyCookieUpdates(response, cookieUpdates)
      return response
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error"
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
