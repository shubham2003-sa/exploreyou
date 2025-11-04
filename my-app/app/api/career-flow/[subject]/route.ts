"use server"

import { NextResponse } from "next/server"
import path from "path"
import { promises as fs } from "fs"

const FLOW_ROOT = path.join(process.cwd(), "..", "career-data")

export async function GET(
  _request: Request,
  context: { params: { subject?: string } },
) {
  const subjectParam = context.params.subject ?? ""
  const safeSubject = subjectParam.trim().toLowerCase().replace(/[^a-z0-9-_]/gi, "")

  if (!safeSubject) {
    return NextResponse.json({ error: "Invalid subject" }, { status: 400 })
  }

  const flowPath = path.join(FLOW_ROOT, safeSubject, "flow.json")

  try {
    const raw = await fs.readFile(flowPath, "utf-8")
    const parsed = JSON.parse(raw)
    return NextResponse.json(parsed)
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err?.code === "ENOENT") {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 })
    }
    console.error("[career-flow] Failed to read flow definition", error)
    return NextResponse.json({ error: "Failed to load flow" }, { status: 500 })
  }
}

