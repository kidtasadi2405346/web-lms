"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TipTapViewer } from "@/components/editor/tiptap-viewer";
import { VideoEmbed } from "@/components/media/video-embed";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Cpu,
  FileText,
  Lock,
  PlayCircle,
  Video,
} from "lucide-react";
import { toggleMaterialCompletionAction } from "@/lib/actions/student";
import { SimulationEmbed } from "@/components/simulation/simulation-embed";
import {
  AudioPlayer,
  type MaterialAudioTrack,
} from "@/components/media/audio-player";
import type { SimulationItem } from "@/lib/types";

export type SiblingMaterial = {
  id: string;
  title: string;
  order_index: number;
  has_video: boolean;
  has_simulation?: boolean;
  is_completed: boolean;
  is_unlocked: boolean;
};

interface MaterialReaderProps {
  material: {
    id: string;
    title: string;
    content?: string | null;
    video_url?: string | null;
    order_index: number;
    module_id: string;
    module_title: string;
    subject_name: string;
    class_name: string;
  };
  simulations?: SimulationItem[];
  audios?: MaterialAudioTrack[];
  isCompletedInitially: boolean;
  siblingMaterials: SiblingMaterial[];
  prevMaterialId: string | null;
  nextMaterialId: string | null;
  nextMaterialUnlocked: boolean;
}

export function MaterialReader({
  material,
  simulations,
  audios = [],
  isCompletedInitially,
  siblingMaterials,
  prevMaterialId,
  nextMaterialId,
  nextMaterialUnlocked,
}: MaterialReaderProps) {
  const router = useRouter();
  const [isCompleted, setIsCompleted] = useState(isCompletedInitially);
  const [loading, setLoading] = useState(false);

  async function handleToggleCompletion() {
    setLoading(true);
    const res = await toggleMaterialCompletionAction(material.id);
    setLoading(false);

    if (res.success && typeof res.isCompleted === "boolean") {
      setIsCompleted(res.isCompleted);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Navigasi Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/student" className="hover:text-foreground">
          Kelas {material.class_name}
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">
          {material.subject_name}
        </span>
        <span>/</span>
        <span className="truncate max-w-xs">{material.module_title}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Konten Utama (3 Kolom) */}
        <div className="space-y-6 lg:col-span-3">
          {/* Header Materi */}
          <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {material.subject_name}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {material.module_title}
                </Badge>
              </div>

              {isCompleted ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 gap-1 border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3" /> Selesai Dipelajari
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 text-muted-foreground"
                >
                  <Circle className="h-2.5 w-2.5" /> Sedang Dipelajari
                </Badge>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {material.title}
            </h1>
          </div>

          {/* Video Embed Player */}
          {material.video_url && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Video className="h-4 w-4 text-primary" />
                <span>Video Pembelajaran</span>
              </div>
              <VideoEmbed url={material.video_url} title={material.title} />
            </div>
          )}

          {audios.length > 0 && (
            <AudioPlayer materialId={material.id} audios={audios} />
          )}

          {/* Konten Uraian Teks HTML (Disanitasi) */}
          {material.content && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <FileText className="h-4 w-4 text-primary" />
                <span>Uraian Materi & Penjelasan</span>
              </div>
              <div className="rounded-xl border bg-card p-5 sm:p-8 shadow-sm">
                <TipTapViewer content={material.content} />
              </div>
            </div>
          )}

          {/* Simulasi Interaktif Embed (Di bawah isi materi) */}
          {simulations && simulations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Cpu className="h-4 w-4 text-primary" />
                <span>
                  Simulasi Interaktif & Praktikum Virtual ({simulations.length})
                </span>
              </div>
              <div className="space-y-6">
                {simulations.map((sim) => (
                  <SimulationEmbed
                    key={sim.id}
                    title={sim.title}
                    url={sim.config?.url || ""}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tombol Aksi Penyelesaian & Navigasi Antar Materi */}
          <div className="rounded-xl border bg-muted/20 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                size="sm"
                variant={isCompleted ? "outline" : "default"}
                className="gap-2"
                onClick={handleToggleCompletion}
                disabled={loading}
              >
                <CheckCircle2
                  className={`h-4 w-4 ${isCompleted ? "text-emerald-600" : ""}`}
                />
                {loading
                  ? "Menyimpan..."
                  : isCompleted
                    ? "Tandai Belum Selesai"
                    : "Tandai Selesai Dipelajari"}
              </Button>

              <div className="flex items-center gap-2">
                {prevMaterialId ? (
                  <Link href={`/student/materi/${prevMaterialId}`}>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <ArrowLeft className="h-3.5 w-3.5" /> Sebelumnya
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="gap-1.5"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Sebelumnya
                  </Button>
                )}

                {nextMaterialId ? (
                  nextMaterialUnlocked ? (
                    <Link href={`/student/materi/${nextMaterialId}`}>
                      <Button size="sm" className="gap-1.5">
                        Lanjut <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled
                      className="gap-1.5"
                    >
                      <Lock className="h-3.5 w-3.5" /> Materi Berikutnya
                      Terkunci
                    </Button>
                  )
                ) : (
                  <Link href="/student">
                    <Button size="sm" variant="secondary" className="gap-1.5">
                      Selesai Bab Ini ✓
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Navigasi Modul (1 Kolom) */}
        <div className="space-y-4">
          <Card className="shadow-sm">
            <div className="border-b bg-muted/30 p-3.5">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Daftar Materi Bab Ini
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {material.module_title}
              </p>
            </div>
            <CardContent className="p-2 space-y-1">
              {siblingMaterials.map((mat, idx) => {
                const isCurrent = mat.id === material.id;
                const isUnlocked = mat.is_unlocked;
                const isDone = mat.is_completed;

                if (!isUnlocked) {
                  return (
                    <div
                      key={mat.id}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-muted-foreground/70 opacity-60"
                      title="Selesaikan materi sebelumnya untuk membuka"
                    >
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {idx + 1}. {mat.title}
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={mat.id}
                    href={`/student/materi/${mat.id}`}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isDone
                          ? "text-foreground hover:bg-muted"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isCurrent
                            ? "text-primary-foreground"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      />
                    ) : mat.has_video ? (
                      <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate flex-1">
                      {idx + 1}. {mat.title}
                    </span>
                    {mat.has_simulation && (
                      <span title="Materi memuat simulasi interaktif">
                        <Cpu
                          className={`h-3 w-3 shrink-0 ${
                            isCurrent
                              ? "text-primary-foreground"
                              : "text-primary"
                          }`}
                        />
                      </span>
                    )}
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Link href="/student" className="block">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
