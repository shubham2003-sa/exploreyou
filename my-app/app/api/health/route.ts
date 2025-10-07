import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET || "videos"

  const result: Record<string, unknown> = {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey,
      NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET: bucket,
    },
    auth: null as null | { authenticated: boolean; email: string | null },
    storage: null as null | { bucket: string; ok: boolean; count: number },
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(result, { status: 200 })
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll() {},
    },
  })

  try {
    const { data } = await supabase.auth.getUser()
    result.auth = { authenticated: !!data?.user, email: data?.user?.email ?? null }
  } catch {
    result.auth = { authenticated: false, email: null }
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).list(undefined, { limit: 1 })
    result.storage = { bucket, ok: !error, count: (data || []).length }
  } catch {
    result.storage = { bucket, ok: false, count: 0 }
  }

  return NextResponse.json(result, { status: 200 })
}





