type GenerateVideoOptions = {
  subject: string
  duration?: number
  style?: string
  theme?: string | null
}

function getBackendUrl() {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL
  if (!url) {
    throw new Error("Video generation backend not configured. Set NEXT_PUBLIC_BACKEND_URL or BACKEND_URL.")
  }
  return url.replace(/\/$/, "")
}

export async function generateAIVideo(options: GenerateVideoOptions): Promise<string> {
  const backendBase = getBackendUrl()
  const response = await fetch(`${backendBase}/generate-video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Video generation failed: ${response.status} ${response.statusText} - ${text}`)
  }

  const data = (await response.json()) as { videoUrl?: string; video_url?: string }
  const videoUrl = data.videoUrl || data.video_url
  if (!videoUrl) {
    throw new Error("Video generation response missing video URL")
  }
  return videoUrl
}
