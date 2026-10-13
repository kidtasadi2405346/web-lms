'use client'

import { useState } from 'react'
import { parseEmbedUrl } from '@/lib/simulations/embed'
import { Button } from '@/components/ui/button'
import {
  ExternalLink,
  Cpu,
  AlertTriangle,
  RotateCcw,
  Maximize2,
} from 'lucide-react'

interface SimulationEmbedProps {
  title: string
  url: string
}

export function SimulationEmbed({ title, url }: SimulationEmbedProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // 1. Periksa ulang URL dengan parseEmbedUrl di sisi tampilan sebelum dirender
  const parseResult = parseEmbedUrl(url)

  if (!parseResult.ok) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Simulasi Tidak Dapat Dimuat</span>
        </div>
        <p className="text-xs leading-relaxed text-destructive/90">
          Tautan embed simulasi untuk &quot;{title}&quot; tidak memenuhi standar keamanan: {parseResult.reason}. Iframe diblokir demi keamanan.
        </p>
      </div>
    )
  }

  const safeUrl = parseResult.url

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden space-y-0">
      {/* Header Bar Simulasi */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Cpu className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate">{title}</h4>
            <p className="text-[11px] text-muted-foreground truncate font-mono">
              {new URL(safeUrl).hostname}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1"
            onClick={() => {
              setIsLoading(true)
              setHasError(false)
              setReloadKey((prev) => prev + 1)
            }}
            title="Muat Ulang Simulasi"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Muat Ulang</span>
          </Button>

          {/* Tombol Buka di Tab Baru (Hanya untuk URL yang lolos validasi) */}
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Buka di tab baru</span>
            </Button>
          </a>
        </div>
      </div>

      {/* Frame Container Responsif 16:9 */}
      <div className="relative aspect-video w-full bg-muted/20">
        {/* Skeleton Loader saat memuat */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/80 backdrop-blur-sm animate-pulse">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Cpu className="h-6 w-6 animate-bounce" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-foreground">Memuat Simulasi Interaktif...</p>
              <p className="text-xs text-muted-foreground">Menyiapkan lingkungan eksperimen ({new URL(safeUrl).hostname})</p>
            </div>
          </div>
        )}

        {/* Fallback Jika Gagal Dimuat */}
        {hasError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-card gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div className="space-y-1 max-w-md">
              <p className="text-sm font-semibold text-foreground">Simulasi Gagal Ditampilkan di Iframe</p>
              <p className="text-xs text-muted-foreground">
                Browser Anda atau penyedia simulasi mungkin membatasi penayangan langsung di dalam halaman ini.
              </p>
            </div>
            <a href={safeUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="h-3.5 w-3.5" /> Buka di tab baru
              </Button>
            </a>
          </div>
        )}

        {/* Iframe Responsif 16:9 dengan atribut keamanan wajib */}
        <iframe
          key={reloadKey}
          src={safeUrl}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false)
            setHasError(true)
          }}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Info Bantuan Fallback di bawah frame */}
      <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
        <span>Gunakan kontrol pada simulasi untuk menguji rangkaian atau konsep elektro.</span>
        <span className="hidden sm:inline">Koneksi aman terenkripsi (HTTPS)</span>
      </div>
    </div>
  )
}
