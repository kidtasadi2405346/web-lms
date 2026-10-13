import { Skeleton } from '@/components/ui/skeleton'

export function MaterialSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6" aria-busy="true" aria-label="Memuat materi">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Header skeleton */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-8 w-3/4 max-w-lg" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Video player skeleton */}
      <div className="aspect-video w-full rounded-xl border bg-muted/40 animate-pulse flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-2 border-primary/20 bg-muted" />
      </div>

      {/* Content paragraphs skeleton */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <div className="pt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
        </div>
      </div>

      {/* Footer navigation skeleton */}
      <div className="flex items-center justify-between border-t pt-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
  )
}
