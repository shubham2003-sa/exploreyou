import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ detail: "Supabase not configured" }, { status: 500 })
  }

  const cookieUpdates: Array<{ name: string; value: string; options?: Partial<ResponseCookie> }> = []

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

  try {
    const { email, password } = (await request.json()) as { email?: string; password?: string }
    if (!email || !password) {
      return NextResponse.json({ detail: "email and password are required" }, { status: 400 })
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const message = (error.message || "").toLowerCase()
      const notConfirmed = message.includes("confirm") || message.includes("confirmed")
      if (notConfirmed) {
        return NextResponse.json({ detail: "Email not confirmed", code: "email_not_confirmed" }, { status: 403 })
      }
      return NextResponse.json({ detail: error.message }, { status: 401 })
    }

    // Return minimal profile info
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const res = NextResponse.json({ email: user?.email ?? email, name: user?.user_metadata?.name ?? null })
    cookieUpdates.forEach(({ name, value, options }) => {
      const baseOptions: Partial<ResponseCookie> = { ...(options || {}) }
      if (process.env.NODE_ENV !== "production") {
        baseOptions.secure = false
        baseOptions.sameSite = "lax"
      }
      if (!baseOptions.path) baseOptions.path = "/"
      res.cookies.set({ name, value, ...baseOptions })
    })
    return res
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request"
    return NextResponse.json({ detail: message }, { status: 400 })
  }
}

