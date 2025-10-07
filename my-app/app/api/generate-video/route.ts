import { type NextRequest, NextResponse } from "next/server"
import { generateAIVideo } from "@/lib/video-generator"

export async function POST(request: NextRequest) {
  try {
    const { subject, duration, style, theme } = await request.json()

    if (!subject) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 })
    }

    // Generate AI video
    const videoUrl = await generateAIVideo({
      subject,
      duration: duration || 20,
      style: style || "abstract",
      theme,
    })

    return NextResponse.json({
      success: true,
      videoUrl,
      metadata: {
        subject,
        duration: duration || 20,
        style: style || "abstract",
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Video generation error:", error)
    return NextResponse.json({ error: "Failed to generate video" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const subject = searchParams.get("subject")

  if (!subject) {
    return NextResponse.json({ error: "Subject parameter is required" }, { status: 400 })
  }

  try {
    const videoUrl = await generateAIVideo({ subject })

    return NextResponse.json({
      success: true,
      videoUrl,
      metadata: {
        subject,
        duration: 20,
        style: "abstract",
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Video generation error:", error)
    return NextResponse.json({ error: "Failed to generate video" }, { status: 500 })
  }
}
