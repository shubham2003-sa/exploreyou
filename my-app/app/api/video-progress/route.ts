import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"

const TABLE_NAME = process.env.NEXT_PUBLIC_SUPABASE_PROGRESS_TABLE || "video_progress"

function getClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value, options))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  return { supabase, response }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase } = getClient(request)
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get("user_id") || undefined
    const user_email = searchParams.get("user_email") || undefined
    const video_id = searchParams.get("video_id") || undefined
    const limit = Number(searchParams.get("limit") || "20")

    let query = supabase.from(TABLE_NAME).select("*").order("updated_at", { ascending: false })
    if (user_id) query = query.eq("user_id", user_id)
    if (user_email) query = query.eq("user_email", user_email)
    if (video_id) query = query.eq("video_id", video_id)
    if (Number.isFinite(limit) && limit > 0) query = query.limit(limit)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [], { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase } = getClient(request)
    const body = (await request.json()) as {
      user_id?: string
      user_email?: string
      video_id: string
      video_url?: string
      progress?: number
      position_seconds?: number
      duration_seconds?: number
      stream_selected?: string
      task_status?: string
      event_name?: string
      event_timestamp?: string
    }

    if (!body.video_id) {
      return NextResponse.json({ detail: "video_id is required" }, { status: 400 })
    }

    const payload = {
      user_id: body.user_id ?? null,
      user_email: body.user_email ?? null,
      video_id: body.video_id,
      video_url: body.video_url ?? null,
      progress: typeof body.progress === "number" ? Math.max(0, Math.min(1, body.progress)) : 0,
      position_seconds: typeof body.position_seconds === "number" ? Math.max(0, body.position_seconds) : 0,
      duration_seconds: typeof body.duration_seconds === "number" ? Math.max(0, body.duration_seconds) : null,
      stream_selected: body.stream_selected ?? null,
      task_status: body.task_status ?? null,
      event_name: body.event_name ?? null,
      last_event_at: body.event_timestamp ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Try upsert by user/video identity. If table has no unique index, gracefully fall back to insert.
    const upsertResult = await supabase
      .from(TABLE_NAME)
      .upsert(payload, { onConflict: "user_id, user_email, video_id" })
      .select()
      .order("updated_at", { ascending: false })
      .limit(1)

    if (!upsertResult.error && upsertResult.data) {
      return NextResponse.json((upsertResult.data && upsertResult.data[0]) || payload, { status: 200 })
    }

    // Fallback: insert and then return latest row for this user/video
    await supabase.from(TABLE_NAME).insert(payload)
    const { data: latest, error: selErr } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("video_id", body.video_id)
      .order("updated_at", { ascending: false })
      .limit(1)
    if (selErr) {
      return NextResponse.json({ detail: selErr.message }, { status: 500 })
    }
    return NextResponse.json((latest && latest[0]) || payload, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error"
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}

