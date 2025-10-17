import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET || "videos"

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json([], { status: 200 })
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll() {
        // no-op
      },
    },
  })

  const { data, error } = await supabase.storage.from(BUCKET).list(undefined, {
    limit: 50,
    sortBy: { column: "name", order: "asc" },
  })
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 500 })
  }

  const items = (data || [])
    .filter((f) => !f.name.endsWith("/"))
    .map((f) => ({ file_name: f.name, file_url: `/${BUCKET}/${encodeURIComponent(f.name)}` }))

  return NextResponse.json(items, { status: 200 })
}





