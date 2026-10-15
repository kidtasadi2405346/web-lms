import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import { MaterialReader, type SiblingMaterial } from "./material-reader";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentMaterialPage({ params }: PageProps) {
  const profile = await requireRole("student");
  const { id: materialId } = await params;

  const supabase = await createClient();

  // 1. Cek izin akses via RPC can_access_material
  const { data: canAccessRpc, error: rpcError } = await supabase.rpc(
    "can_access_material",
    {
      p_material_id: materialId,
    },
  );

  // 2. Ambil data materi dan modul
  const { data: material, error: matError } = await supabase
    .from("materials")
    .select(
      `
      id,
      title,
      content,
      video_url,
      order_index,
      module_id,
      simulations (
        id,
        material_id,
        title,
        type,
        config,
        order_index,
        created_at
      ),
      material_audios (
        id,
        title,
        file_path,
        duration_seconds,
        transcript,
        order_index
      ),
      modules:module_id (
        id,
        title,
        class_id,
        subject_id,
        subjects:subject_id (name),
        classes:class_id (name)
      )
    `,
    )
    .eq("id", materialId)
    .maybeSingle();

  // Jika materi tidak ditemukan di database sama sekali
  if (!material) {
    // Bisa jadi RLS memblokir query karena terkunci! Cek apakah materi benar-benar ada di database
    return (
      <div className="mx-auto max-w-lg py-12 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Lock className="h-8 w-8" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">
            Materi Belum Dapat Dibuka
          </h1>
          <p className="text-sm text-muted-foreground">
            Materi ini terkunci atau dibatasi oleh sistem. Selesaikan materi
            pembelajaran sebelumnya terlebih dahulu untuk membukanya.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/student">
            <Button variant="default" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard Siswa
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Jika RPC can_access_material secara eksplisit menolak akses
  if (canAccessRpc === false) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Lock className="h-8 w-8" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Materi Terkunci</h1>
          <p className="text-sm text-muted-foreground">
            Untuk menjaga urutan belajar yang baik, Anda harus menyelesaikan
            materi-materi sebelumnya di bab ini sebelum dapat mengakses materi{" "}
            <strong>&quot;{material.title}&quot;</strong>.
          </p>
        </div>
        <div className="pt-2">
          <Link href="/student">
            <Button variant="default" className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard Siswa
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const moduleData = material.modules as any;
  const moduleId = material.module_id;

  // 3. Ambil seluruh materi di modul ini untuk navigasi playlist samping & tombol lanjut
  const [{ data: siblingMaterialsRaw }, { data: completions }] =
    await Promise.all([
      supabase
        .from("materials")
        .select("id, title, order_index, video_url, simulations (id)")
        .eq("module_id", moduleId)
        .order("order_index", { ascending: true }),
      supabase
        .from("material_completions")
        .select("material_id")
        .eq("student_id", profile.id),
    ]);

  const completedSet = new Set(
    (completions ?? []).map((c: any) => c.material_id),
  );
  const isCurrentCompleted = completedSet.has(material.id);

  // Hitung status unlock sekuensial untuk seluruh materi di modul ini
  let isPriorCompleted = true;
  const siblingMaterials: SiblingMaterial[] = (siblingMaterialsRaw ?? []).map(
    (m: any, idx: number) => {
      const isDone = completedSet.has(m.id);
      const isUnlocked = idx === 0 || isPriorCompleted;
      isPriorCompleted = isPriorCompleted && isDone;

      return {
        id: m.id,
        title: m.title,
        order_index: m.order_index,
        has_video: Boolean(m.video_url && m.video_url.trim().length > 0),
        has_simulation: Boolean(m.simulations && m.simulations.length > 0),
        is_completed: isDone,
        is_unlocked: isUnlocked,
      };
    },
  );

  // Cari materi sebelum dan setelahnya
  const currentIndex = siblingMaterials.findIndex((m) => m.id === material.id);
  const prevMaterial =
    currentIndex > 0 ? siblingMaterials[currentIndex - 1] : null;
  const nextMaterial =
    currentIndex < siblingMaterials.length - 1
      ? siblingMaterials[currentIndex + 1]
      : null;

  const activeSimulations = (material.simulations ?? []).sort(
    (a: any, b: any) => a.order_index - b.order_index,
  );

  return (
    <MaterialReader
      material={{
        id: material.id,
        title: material.title,
        content: material.content,
        video_url: material.video_url,
        order_index: material.order_index,
        module_id: moduleId,
        module_title: moduleData?.title ?? "Modul",
        subject_name: moduleData?.subjects?.name ?? "Mata Pelajaran",
        class_name: moduleData?.classes?.name ?? "Kelas",
      }}
      simulations={activeSimulations}
      audios={material.material_audios ?? []}
      isCompletedInitially={isCurrentCompleted}
      siblingMaterials={siblingMaterials}
      prevMaterialId={prevMaterial?.id ?? null}
      nextMaterialId={nextMaterial?.id ?? null}
      nextMaterialUnlocked={Boolean(nextMaterial?.is_unlocked)}
    />
  );
}
