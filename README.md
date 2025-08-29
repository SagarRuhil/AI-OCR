# OCR Image Text Extraction (Printed + Handwritten/Cursive)

A fast, minimal website to extract text from images (including cursive handwriting) using Groq’s multimodal vision models. Upload an image, click Extract, copy or download the result. Built with Next.js App Router and designed for accuracy, speed, and a clean UI.

## Features
- Simple flow: Upload → Extract → Copy/Download
- High-accuracy OCR tuned for printed and cursive handwriting
- Fast: silent client-side resize/compression to speed uploads
- Reliable: model fallback (Maverick → Scout) and short retries for transient errors
- Professional, colorful, accessible UI with responsive layout

## Tech Stack
- Framework: Next.js (App Router, Route Handlers)
- UI: Tailwind CSS (v4), shadcn/ui primitives
- AI: Groq multimodal vision models
  - Primary: meta-llama/llama-4-maverick-17b-128e-instruct
  - Fallback: meta-llama/llama-4-scout-17b-16e-instruct
- Language: TypeScript
- Hosting: Vercel (recommended)

## Architecture
- Client (app/page.tsx)
  - Drag-and-drop image upload with live preview
  - Silent preprocessing (resize to sensible max dimension, light denoise/contrast) for speed/clarity
  - Calls POST /api/extract-text and displays a single text result with a confidence indicator
- Server (app/api/extract-text/route.ts)
  - Validates input, calls Groq vision model with deterministic settings
  - Fallback to a second vision model on failure
  - Returns only JSON: { success, text, confidence }

## How It Works
1. You upload or drop an image (JPG/PNG/JPEG).
2. The client reduces the image size to a clear, model-friendly resolution (to speed transfer and inference).
3. The server invokes Groq’s vision model with a concise OCR prompt tuned for cursive and low noise, temperature kept low for determinism.
4. If the primary model fails transiently, the server retries briefly and/or falls back to the secondary model.
5. The server returns a clean text string and a confidence estimate. The UI shows the text with copy/download actions.

## Getting Started
- Vercel recommended. You can publish directly from the v0 preview.
- Integrations
  - Groq: Use the built-in Groq integration in Project Settings or provide an API key via env.

### Environment Variables
- GROQ_API_KEY: Your Groq API key (automatically provided when the Groq integration is connected)

No .env file is needed in v0; use Project Settings → Environment Variables (or the Groq integration) instead.

## Usage
- Open the site
- Drag-and-drop an image (or click to browse)
- Click “Extract”
- Copy or download the extracted text

## API
POST /api/extract-text
- Body: multipart/form-data with a single “image” field (JPG/PNG/JPEG)
- Response (JSON):
  - success: boolean
  - text: string (extracted text)
  - confidence: number (0–1)

Example response:
{
  "success": true,
  "text": "This is the extracted text...",
  "confidence": 0.92
}

## Accuracy Tips
- Use clear images (avoid motion blur; good lighting).
- Crop to the text region if possible.
- Prefer upright images; rotate before upload if needed.
- Printed or neat cursive yields the best accuracy; extremely stylized, low-resolution, or noisy scans reduce quality.

## Accessibility & Performance
- Color choices meet WCAG AA for typical text usage.
- Mobile‑first layout, semantic HTML, keyboard‑friendly actions.
- Client-side preprocessing reduces upload time and improves throughput.

## Troubleshooting
- Model errors (404/Access): Ensure the Groq integration is connected or GROQ_API_KEY is set in Project Settings.
- Deprecated models: We already target Llama 4 models (Maverick with Scout fallback). If Groq changes names, update the model strings in app/api/extract-text/route.ts.
- LightningCSS / CSS WASM errors: Ensure globals.css has no remote @import and that fonts load via next/font.

## Roadmap
- Batch uploads
- Result history (local-only)
- Built-in rotate/crop tools
