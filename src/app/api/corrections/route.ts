import { correctionHttpStatus, submitCorrection } from "@/lib/corrections"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let input: unknown
  try {
    input = await request.json()
  } catch {
    return NextResponse.json({ saved: false, reason: "invalid" }, { status: 400 })
  }
  const result = await submitCorrection(input)
  return NextResponse.json(result, { status: correctionHttpStatus(result) })
}
