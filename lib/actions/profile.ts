"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ThemePreference = "light" | "dark" | "system";

export async function updateProfilePreferencesAction(input: {
  username?: string;
  theme?: ThemePreference;
  audio_enabled?: boolean;
}): Promise<{ success?: boolean; error?: string }> {
  if (!input || typeof input !== "object") {
    return { error: "Data pengaturan profil tidak valid." };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sesi Anda telah berakhir. Silakan masuk kembali." };

  const updates: {
    username?: string;
    theme?: ThemePreference;
    audio_enabled?: boolean;
  } = {};

  if (input.username !== undefined) {
    if (typeof input.username !== "string") {
      return { error: "Username tidak valid." };
    }
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(username)) {
      return {
        error:
          "Username harus 3–24 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.",
      };
    }
    updates.username = username;
  }

  if (input.theme !== undefined) {
    if (
      typeof input.theme !== "string" ||
      !["light", "dark", "system"].includes(input.theme)
    ) {
      return { error: "Pilihan tema tidak valid." };
    }
    updates.theme = input.theme;
  }

  if (input.audio_enabled !== undefined) {
    if (typeof input.audio_enabled !== "boolean") {
      return { error: "Preferensi audio tidak valid." };
    }
    updates.audio_enabled = input.audio_enabled;
  }

  if (Object.keys(updates).length === 0) {
    return { error: "Tidak ada pengaturan yang diperbarui." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", profile.id)
    .select("id")
    .maybeSingle();

  if (error?.code === "23505") {
    return { error: "Username tersebut sudah digunakan." };
  }
  if (error) return { error: `Pengaturan profil gagal disimpan: ${error.message}` };
  if (!data) return { error: "Profil tidak ditemukan atau pengaturan tidak dapat diperbarui." };

  revalidatePath("/", "layout");
  return { success: true };
}
