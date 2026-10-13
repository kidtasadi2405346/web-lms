import React from 'react'

interface RichContentProps {
  content?: string | null
  className?: string
}

export const RICH_CONTENT_PROSE_CLASSES = `prose prose-neutral dark:prose-invert max-w-none
  prose-headings:font-bold
  prose-h2:text-xl prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-3
  prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2
  prose-p:leading-relaxed prose-p:my-2
  prose-ul:list-disc prose-ul:my-2 prose-ul:pl-6
  prose-ol:list-decimal prose-ol:my-2 prose-ol:pl-6
  prose-li:my-1
  prose-a:text-emerald-600 hover:prose-a:text-emerald-700 dark:prose-a:text-emerald-400 dark:hover:prose-a:text-emerald-300 prose-a:underline prose-a:font-medium
  prose-blockquote:border-l-4 prose-blockquote:border-emerald-600 dark:prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50/50 dark:prose-blockquote:bg-emerald-950/20 prose-blockquote:py-1.5 prose-blockquote:px-4 prose-blockquote:my-3 prose-blockquote:rounded-r
  prose-code:bg-muted prose-code:text-foreground prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
  prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:rounded-lg prose-pre:p-4 prose-pre:my-3
  prose-hr:my-6 prose-hr:border-border
  prose-table:w-full prose-table:my-4 prose-table:border-collapse
  prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-muted/50 prose-th:text-left prose-th:font-semibold
  prose-td:border prose-td:border-border prose-td:p-2
  prose-img:rounded-lg prose-img:my-4 prose-img:shadow-sm prose-img:max-w-full prose-img:h-auto [&_.image-align-left]:mr-auto [&_.image-align-center]:mx-auto [&_.image-align-right]:ml-auto [&_.image-size-small]:w-1/3 [&_.image-size-medium]:w-2/3 [&_.image-size-full]:w-full`

export function RichContent({ content, className = '' }: RichContentProps) {
  if (!content || !content.trim() || content === '<p></p>') {
    return <p className="italic text-muted-foreground text-sm">Tidak ada uraian teks.</p>
  }

  return (
    <div
      className={`${RICH_CONTENT_PROSE_CLASSES} ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
