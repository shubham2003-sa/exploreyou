import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(null, { status: 200 })
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // No-op for GET
      },
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return NextResponse.json(null, { status: 200 })
  }

  const user = data.user
  return NextResponse.json({ email: user.email, name: user.user_metadata?.name ?? null }, { status: 200 })
}





