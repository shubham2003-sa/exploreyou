import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies"

type CookieUpdate = { name: string; value: string; options?: Partial<ResponseCookie> }

export const runtime = "nodejs"

function applyCookies(response: NextResponse, updates: CookieUpdate[]) {
  updates.forEach(({ name, value, options }) => {
    const baseOptions: Partial<ResponseCookie> = { ...(options || {}) }
    if (process.env.NODE_ENV !== "production") {
      baseOptions.secure = false
      baseOptions.sameSite = "lax"
    }
    if (!baseOptions.path) baseOptions.path = "/"
    response.cookies.set({ name, value, ...baseOptions })
  })
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ detail: "Supabase not configured" }, { status: 500 })
  }

  const cookieUpdates: CookieUpdate[] = []

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieUpdates.push({ name, value, options })
        })
      },
    },
  })

  const payload = (await request.json().catch(() => ({}))) as {
    points_earned?: number
    points_possible?: number
    source?: string | null
    user_email?: string | null
  }

  const pointsEarned = Math.max(0, Number.isFinite(payload.points_earned) ? Number(payload.points_earned) : 0)
  const pointsPossibleInput = Math.max(
    0,
    Number.isFinite(payload.points_possible) ? Number(payload.points_possible) : pointsEarned,
  )

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id ?? null
  const email = payload.user_email ?? userData?.user?.email ?? null

  if (!userId) {
    const response = NextResponse.json({ detail: "Unable to resolve user" }, { status: 401 })
    applyCookies(response, cookieUpdates)
    return response
  }

  const { data: currentRecord, error: fetchError } = await supabase
    .from("user_scores")
    .select("total_points,total_possible")
    .eq("user_id", userId)
    .maybeSingle()

  if (fetchError) {
    const response = NextResponse.json({ detail: fetchError.message || "Failed to load existing score" }, { status: 500 })
    applyCookies(response, cookieUpdates)
    return response
  }

  const existingPoints = Number(currentRecord?.total_points ?? 0)
  const existingPossible = Number(currentRecord?.total_possible ?? 0)

  const totalPoints = existingPoints + pointsEarned
  const totalPossible = existingPossible + pointsPossibleInput

  const { data: upserted, error: upsertError } = await supabase
    .from("user_scores")
    .upsert(
      {
        user_id: userId,
        user_email: email,
        total_points: totalPoints,
        total_possible: totalPossible,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("total_points,total_possible")
    .single()

  if (upsertError || !upserted) {
    const response = NextResponse.json({ detail: upsertError?.message || "Failed to update score" }, { status: 500 })
    applyCookies(response, cookieUpdates)
    return response
  }

  const summary = {
    totalPoints: Number(upserted.total_points ?? 0),
    totalPossible: Number(upserted.total_possible ?? 0),
    scorePercent:
      Number(upserted.total_possible ?? 0) > 0
        ? (Number(upserted.total_points ?? 0) / Number(upserted.total_possible ?? 0)) * 100
        : 0,
  }

  const response = NextResponse.json(summary, { status: 200 })
  applyCookies(response, cookieUpdates)
  return response
}
