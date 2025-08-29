"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Upload, FileText, Copy, Download, Loader2, Sparkles, CheckCircle, AlertCircle, Zap } from "lucide-react"

interface ExtractedMetadata {
  wordCount: number
  characterCount: number
  estimatedReadingTime: number
  model?: string
  correctionModel?: string
  verificationModel?: string
  highAccuracy?: boolean
}

export default function OCRPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState<string>("")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()

  const preprocessToPngDataUrl = async (srcUrl: string) => {
    return new Promise<string>((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.src = srcUrl || ""
      img.onload = () => {
        const canvas = canvasRef.current!
        const ctx = canvas.getContext("2d")!
        const maxDim = 2000
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        canvas.width = w
        canvas.height = h
        ctx.drawImage(img, 0, 0, w, h)

        // grayscale + light contrast for OCR
        const data = ctx.getImageData(0, 0, w, h)
        const d = data.data
        const contrast = 1.15
        for (let i = 0; i < d.length; i += 4) {
          let r = d[i],
            g = d[i + 1],
            b = d[i + 2]
          const gray = 0.299 * r + 0.587 * g + 0.114 * b
          r = g = b = gray
          r = (r - 128) * contrast + 128
          g = (g - 128) * contrast + 128
          b = (b - 128) * contrast + 128
          d[i] = Math.max(0, Math.min(255, r))
          d[i + 1] = Math.max(0, Math.min(255, g))
          d[i + 2] = Math.max(0, Math.min(255, b))
        }
        ctx.putImageData(data, 0, 0)
        resolve(canvas.toDataURL("image/png"))
      }
    })
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select a PNG/JPG/JPEG/WebP image.",
        variant: "destructive",
      })
      return
    }
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setExtractedText("")
    setConfidence(null)
    setProcessingProgress(0)
    setProgressMessage("")
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setExtractedText("")
      setConfidence(null)
      setProcessingProgress(0)
      setProgressMessage("")
    }
  }
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault()

  const extractText = async () => {
    if (!selectedFile) return
    setIsProcessing(true)
    setProcessingProgress(0)
    setProgressMessage("Optimizing image…")

    // lightweight progress simulation
    const stages = [
      { p: 20, m: "Optimizing image…" },
      { p: 55, m: "Analyzing text regions…" },
      { p: 85, m: "Transcribing text…" },
    ]
    let idx = 0
    const t = setInterval(() => {
      if (idx < stages.length) {
        setProcessingProgress(stages[idx].p)
        setProgressMessage(stages[idx].m)
        idx++
      }
    }, 600)

    try {
      let fileToSend = selectedFile
      if (previewUrl) {
        const processedDataUrl = await preprocessToPngDataUrl(previewUrl)
        const blob = await fetch(processedDataUrl).then((r) => r.blob())
        fileToSend = new File([blob], selectedFile.name.replace(/\.\w+$/, "") + ".png", { type: "image/png" })
      }

      const formData = new FormData()
      formData.append("image", fileToSend)

      const res = await fetch("/api/extract-text", { method: "POST", body: formData })
      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        throw new Error(errText || "Failed to extract text")
      }
      const data = await res.json()
      setExtractedText(data.text || "")
      setConfidence(typeof data.confidence === "number" ? data.confidence : null)
      setProcessingProgress(100)
      setProgressMessage("Completed")
      toast({ title: "Extraction complete", description: "Text extracted successfully." })
    } catch (e) {
      console.error(e)
      setProcessingProgress(0)
      setProgressMessage("")
      toast({ title: "Extraction failed", description: "Please try another image.", variant: "destructive" })
    } finally {
      setIsProcessing(false)
      clearInterval(t)
    }
  }

  const copyToClipboard = () => {
    if (!extractedText) return
    navigator.clipboard.writeText(extractedText)
    toast({ title: "Copied", description: "Text copied to clipboard." })
  }
  const downloadText = () => {
    if (!extractedText) return
    const blob = new Blob([extractedText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `extracted-text-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const confBadge = (conf: number) => {
    if (conf >= 0.85) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
    if (conf >= 0.7) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    if (conf >= 0.5) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  }
  const confIcon = (conf: number) => {
    if (conf >= 0.85) return <Sparkles className="h-3 w-3" />
    if (conf >= 0.7) return <CheckCircle className="h-3 w-3" />
    return <AlertCircle className="h-3 w-3" />
  }

  return (
    <div className="min-h-screen bg-background">
      <canvas ref={canvasRef} className="hidden" />
      <header className="border-b">
        <div className="container mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 rounded-xl bg-primary text-primary-foreground">
              <Zap className="h-6 w-6" />
            </div>
            <h1 className="text-balance font-semibold text-5xl">AI OCR Extractor</h1>
          </div>
          <p className="mt-4 text-center text-muted-foreground text-pretty max-w-2xl mx-auto">
            Fast, accurate text extraction from images and cursive handwriting. Upload, extract, and copy your text—no
            extra settings.
          </p>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-10 grid lg:grid-cols-2 gap-8">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Upload Image
            </CardTitle>
            <CardDescription>PNG, JPG, JPEG, or WebP up to ~10MB.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input id="file-input" type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              {previewUrl ? (
                <div className="space-y-4">
                  <img
                    src={previewUrl || "/placeholder.svg?height=320&width=640&query=preview"}
                    alt="Preview"
                    className="max-h-80 mx-auto rounded-lg border"
                  />
                  <p className="text-sm text-muted-foreground">
                    {selectedFile?.name} • {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) : "0"} MB
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium">Drop your image here</p>
                  <p className="text-sm text-muted-foreground">or click to browse files</p>
                </div>
              )}
            </div>

            <Button onClick={extractText} disabled={!selectedFile || isProcessing} className="w-full h-11">
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" /> Extract Text
                </>
              )}
            </Button>

            {isProcessing && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{progressMessage || "Processing…"}</span>
                  <span className="text-primary font-medium">{Math.round(processingProgress)}%</span>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Result
            </CardTitle>
            <CardDescription>Copy or download your extracted text.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {confidence !== null && (
              <div className="flex items-center justify-end">
                <Badge className={`${confBadge(confidence)} flex items-center gap-1 px-3 py-1`}>
                  {confIcon(confidence)} {Math.round(confidence * 100)}%
                </Badge>
              </div>
            )}

            <Textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder="Extracted text will appear here…"
              className="min-h-[360px] resize-none font-mono text-sm leading-relaxed"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={copyToClipboard}
                disabled={!extractedText}
                className="flex-1 bg-transparent"
              >
                <Copy className="h-4 w-4 mr-2" /> Copy
              </Button>
              <Button
                variant="outline"
                onClick={downloadText}
                disabled={!extractedText}
                className="flex-1 bg-transparent"
              >
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
