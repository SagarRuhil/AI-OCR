import { type NextRequest, NextResponse } from "next/server"
import { groq } from "@ai-sdk/groq"
import { generateText } from "ai"

const PRIMARY_MODEL = "meta-llama/llama-4-maverick-17b-128e-instruct"
const FALLBACK_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Starting OCR text extraction")

    const formData = await request.formData()
    const image = formData.get("image") as File | null

    if (!image) {
      console.log("[v0] No image provided in request")
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    console.log("[v0] Image received:", { name: image.name, type: image.type, size: image.size })

    // Convert image to base64 data URL
    const bytes = await image.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const mimeType = image.type || "image/png"
    const dataUrl = `data:${mimeType};base64,${base64}`

    console.log("[v0] Image converted to base64, length:", base64.length)

    // Concise, high-accuracy OCR prompt with cursive emphasis
    const systemPrompt = [
      "You are a production-grade OCR engine.",
      "Extract ALL visible text exactly as written. Maintain reading order and line breaks.",
      "Handle cursive and connected handwriting carefully: distinguish ‘rn’ vs ‘m’, ‘cl’ vs ‘d’, ‘o’ vs ‘a’, ‘0’ vs ‘O’, ‘1’ vs ‘l’ vs ‘I’, ‘5’ vs ‘S’, ‘2’ vs ‘Z’.",
      "Prefer literal transcription over normalization; do not expand abbreviations. If a token is unreadable, use [illegible].",
      "Avoid hallucinations. Output only what is truly present in the image.",
    ].join("\n")

    const userText =
      "Output: Plain text only with original line breaks. If no text is present, output exactly: No text detected."

    async function callModelWithRetries(modelId: string, maxAttempts = 3) {
      let lastError: unknown = null
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`[v0] Calling Groq model: ${modelId} (attempt ${attempt}/${maxAttempts})`)
          const { text } = await generateText({
            model: groq(modelId),
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  { type: "text", text: userText },
                  { type: "image", image: dataUrl },
                ],
              },
            ],
            temperature: 0,
            maxTokens: 7000,
          })
          return text
        } catch (err: any) {
          lastError = err
          const message = typeof err?.message === "string" ? err.message : String(err)
          console.warn(`[v0] Groq call failed for ${modelId} (attempt ${attempt}):`, message)

          if (message.includes("does not exist") || message.includes("do not have access")) {
            break
          }

          await new Promise((r) => setTimeout(r, 300 * attempt))
        }
      }
      throw lastError
    }

    let usedModel = PRIMARY_MODEL
    let text: string | null = null
    try {
      text = await callModelWithRetries(PRIMARY_MODEL)
    } catch (primaryErr: any) {
      console.warn("[v0] Primary model failed, attempting fallback:", primaryErr?.message || primaryErr)
      try {
        usedModel = FALLBACK_MODEL
        text = await callModelWithRetries(FALLBACK_MODEL)
      } catch (fallbackErr) {
        console.error("[v0] Fallback model failed:", fallbackErr)
        throw primaryErr || fallbackErr
      }
    }

    if (!text) {
      throw new Error("Groq returned empty response")
    }

    console.log("[v0] Text extraction successful, length:", text.length)

    const confidence = calculateConfidence(text)

    return NextResponse.json({
      text: text.trim(),
      confidence,
      success: true,
    })
  } catch (error) {
    console.error("[v0] Error extracting text:", error)
    if (error instanceof Error) {
      console.error("[v0] Error message:", error.message)
      console.error("[v0] Error stack:", error.stack)
    }
    return NextResponse.json(
      {
        error: "Failed to extract text from image",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Simplified confidence heuristic (kept lightweight)
function calculateConfidence(text: string): number {
  if (!text || text === "No text detected" || text.trim().length === 0) return 0.05
  const words = text.split(/\s+/).filter(Boolean)
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  let c = 0.25
  if (text.length > 40) c += 0.15
  if (text.length > 200) c += 0.1
  if (lines.length > 2) c += 0.08
  if (words.length > 20) c += 0.07
  const illegible = (text.match(/\[illegible\]/gi) || []).length
  if (illegible > 0) c -= Math.min(0.2, (illegible / Math.max(words.length, 1)) * 0.5)
  return Math.min(0.98, Math.max(0.05, c))
}
