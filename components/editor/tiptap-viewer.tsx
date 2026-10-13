'use client'

import { sanitizeHtml } from '@/lib/sanitize'
import { RichContent } from './rich-content'

interface TipTapViewerProps {
  content?: string | null
  className?: string
}

export function TipTapViewer({ content, className = '' }: TipTapViewerProps) {
  if (!content || !content.trim() || content === '<p></p>') {
    return <p className="italic text-muted-foreground text-sm">Tidak ada uraian teks.</p>
  }

  const cleanHtml = sanitizeHtml(content)

  return <RichContent content={cleanHtml} className={className} />
}
