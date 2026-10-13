'use client'

import { parseVideoEmbed } from '@/lib/embed'
import { ExternalLink, Video } from 'lucide-react'

interface VideoEmbedProps {
  url?: string | null
  title?: string
  className?: string
}

export function VideoEmbed({ url, title = 'Video materi', className = '' }: VideoEmbedProps) {
  const { type, embedUrl, originalUrl } = parseVideoEmbed(url)

  if (!url || !url.trim()) {
    return null
  }

  if (!embedUrl) {
    return (
      <div className={`rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground ${className}`}>
        <p className="font-medium text-foreground">Format link video tidak dikenali</p>
        <p className="mt-1 text-xs">
          Hanya mendukung tautan publik <strong>YouTube</strong> atau <strong>Google Drive</strong>.
        </p>
        {originalUrl && (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline hover:text-primary/80"
          >
            Buka tautan asli <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-xl border bg-black/5 shadow-sm dark:bg-black/40 ${className}`}>
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Video className="h-3.5 w-3.5 text-primary" />
          {type === 'youtube' ? 'YouTube Player' : 'Google Drive Video'}
        </span>
        <a
          href={originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs hover:text-foreground"
        >
          Buka di tab baru <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="relative aspect-video w-full bg-black">
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </div>
  )
}
