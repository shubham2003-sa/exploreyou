import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ detail: "Supabase not configured" }, { status: 500 })
  }

  let response = NextResponse.json({ ok: true })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value, options))
        response = NextResponse.json({ ok: true })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  try {
    const { email, password, name } = (await request.json()) as { email?: string; password?: string; name?: string }
    if (!email || !password) {
      return NextResponse.json({ detail: "email and password are required" }, { status: 400 })
    }

    // Sign up user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: name ? { name } : undefined,
        emailRedirectTo: undefined,
      },
    })
    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 400 })
    }

    // If email confirmations are enabled, user may need to confirm. Still return 200 with hint.
    const needsConfirmation = !data.user?.email_confirmed_at
    const body: Record<string, unknown> = { success: true, needsConfirmation }
    if (data.user?.email) body.email = data.user.email

    response = NextResponse.json(body, { status: 200 })
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request"
    return NextResponse.json({ detail: message }, { status: 400 })
  }
}




