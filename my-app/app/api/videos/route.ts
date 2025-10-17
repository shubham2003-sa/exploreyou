import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET || "videos"
const SIGNED_URL_TTL = Number(process.env.NEXT_PUBLIC_SUPABASE_SIGNED_URL_TTL ?? "3600")

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

  const files = (data || []).filter((f) => !f.name.endsWith("/"))
  if (!files.length) {
    return NextResponse.json([], { status: 200 })
  }

  const paths = files.map((f) => f.name)
  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL)

  if (signedError) {
    const fallbackItems = files.map((f) => ({
      file_name: f.name,
      file_url: `/${BUCKET}/${encodeURIComponent(f.name)}`,
      signed: false,
    }))
    return NextResponse.json(fallbackItems, { status: 200 })
  }

  const signedMap = new Map<string, string>()
  for (const entry of signedData ?? []) {
    if (entry?.path && entry?.signedUrl) {
      signedMap.set(entry.path, entry.signedUrl)
    }
  }

  const items = files.map((f) => {
    const signedUrl = signedMap.get(f.name)
    if (signedUrl) {
      return { file_name: f.name, file_url: signedUrl, signed: true }
    }
    return { file_name: f.name, file_url: `/${BUCKET}/${encodeURIComponent(f.name)}`, signed: false }
  })

  return NextResponse.json(items, { status: 200 })
}
