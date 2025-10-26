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

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const emailParam = searchParams.get("user_email")

  let userId: string | null = null
  let email: string | null = emailParam

  const { data: userData } = await supabase.auth.getUser()
  if (userData?.user) {
    userId = userData.user.id
    if (!email) {
      email = userData.user.email ?? null
    }
  }

  if (!userId && !email) {
    const response = NextResponse.json({ detail: "Unable to resolve user" }, { status: 401 })
    applyCookies(response, cookieUpdates)
    return response
  }

  let query = supabase.from("user_scores").select("total_points,total_possible").limit(1)
  if (userId) {
    query = query.eq("user_id", userId)
  } else if (email) {
    query = query.eq("user_email", email)
  }

  const { data: record, error } = await query.maybeSingle()
  if (error) {
    const response = NextResponse.json({ detail: error.message || "Failed to fetch score" }, { status: 500 })
    applyCookies(response, cookieUpdates)
    return response
  }

  const totalPoints = Number(record?.total_points ?? 0)
  const totalPossible = Number(record?.total_possible ?? 0)
  const scorePercent = totalPossible > 0 ? (totalPoints / totalPossible) * 100 : 0

  const summary = {
    totalPoints,
    totalPossible,
    scorePercent,
  }

  const response = NextResponse.json(summary, { status: 200 })
  applyCookies(response, cookieUpdates)
  return response
}
