"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Laptop, Loader2, Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { updateProfilePreferencesAction } from "@/lib/actions/profile";
import { useProfilePreferences } from "@/components/layout/profile-preferences";
import { avatarPublicUrl, AVATAR_BUCKET } from "@/lib/avatar";
import { UserAvatar } from "@/components/layout/user-avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/roles";
import type { Profile } from "@/lib/types";

type Message = { text: string; type: "success" | "error" };

export function SettingsView({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { theme, audioEnabled, setTheme, setAudioEnabled } = useProfilePreferences();

  const [username, setUsername] = useState(profile.username ?? "");
  const [savedUsername] = useState(profile.username ?? "");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(
    avatarPublicUrl(profile.avatar_url),
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  /* ── Username ── */
  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await updateProfilePreferencesAction({ username });
    setBusy(false);
    if (result.error) {
      setMessage({ text: result.error, type: "error" });
    } else {
      setMessage({ text: "Username berhasil disimpan.", type: "success" });
    }
  }

  const usernameUnchanged =
    username.trim().toLowerCase() === savedUsername.trim().toLowerCase();

  /* ── Tema ── */
  async function changeTheme(next: "light" | "dark" | "system") {
    setMessage(null);
    const error = await setTheme(next);
    if (error) setMessage({ text: error, type: "error" });
  }

  /* ── Audio ── */
  async function changeAudio(enabled: boolean) {
    setMessage(null);
    const error = await setAudioEnabled(enabled);
    if (error) setMessage({ text: error, type: "error" });
  }

  /* ── Avatar ── */
  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        warning?: string;
        avatar_url?: string;
      };
      if (!response.ok || !result.success || !result.avatar_url) {
        setMessage({ text: result.error ?? "Avatar gagal diperbarui.", type: "error" });
      } else {
        const newUrl = avatarPublicUrl(result.avatar_url);
        if (newUrl) {
          setAvatarSrc(`${newUrl}?t=${Date.now()}`);
        }
        setMessage({
          text: result.warning ?? "Foto avatar berhasil diperbarui.",
          type: "success",
        });
        router.refresh();
      }
    } catch {
      setMessage({
        text: "Avatar gagal diunggah. Periksa koneksi internet Anda.",
        type: "error",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  const themeOptions = [
    { value: "light" as const, label: "Terang", icon: Sun },
    { value: "dark" as const, label: "Gelap", icon: Moon },
    { value: "system" as const, label: "Sistem", icon: Laptop },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pengaturan Akun</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola identitas akun dan sesuaikan preferensi tampilan aplikasi Anda.
        </p>
      </div>

      {/* Status Banner */}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-current" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Card */}
      <Card className="divide-y divide-border/70 overflow-hidden">
        {/* ── Section 1: Profil ── */}
        <div className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Profil</h2>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            {/* Avatar */}
            <div className="relative shrink-0 self-start">
              {uploading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-black/50">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
              <UserAvatar
                src={avatarSrc}
                name={profile.name}
                className="h-24 w-24 border-2 border-primary/20 shadow-sm"
              />
            </div>

            {/* Identity Info */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-base font-bold text-foreground leading-tight">
                {profile.name}
              </p>
              <span className="inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {ROLE_LABEL[profile.role]}
              </span>
              <p className="text-xs text-muted-foreground">
                Nomor Identitas:{" "}
                <span className="font-mono font-medium text-foreground">
                  {profile.identity_number}
                </span>
              </p>
            </div>

            {/* Change Photo */}
            <div className="shrink-0 space-y-1.5 sm:self-start">
              <label
                htmlFor="settings-avatar-file"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-card px-4 py-2 text-xs font-semibold text-primary shadow-xs hover:bg-accent/60 transition-colors"
              >
                Ganti Foto
              </label>
              <input
                id="settings-avatar-file"
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => void uploadAvatar(e)}
              />
              <p className="text-[11px] text-muted-foreground">
                JPG, PNG, WebP. Maks. 2 MB.
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 2: Username ── */}
        <div className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Username Unik</h2>
          <form onSubmit={saveUsername}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label
                  htmlFor="settings-username"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Username
                </label>
                <input
                  id="settings-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  minLength={3}
                  maxLength={24}
                  pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,23}"
                  autoComplete="username"
                  placeholder="misal: ahmad.fauzi"
                  className="w-full rounded-lg border border-input/80 bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={busy || usernameUnchanged}
                className="shrink-0 gap-1.5"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Simpan
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              3–24 karakter: huruf kecil, angka, titik, strip, garis bawah.
            </p>
          </form>
        </div>

        {/* ── Section 3: Tema ── */}
        <div className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Tema Tampilan</h2>
          <div
            role="radiogroup"
            aria-label="Pilih tema tampilan"
            className="grid grid-cols-3 gap-3 max-w-xl"
          >
            {themeOptions.map(({ value: val, label, icon: Icon }) => {
              const isActive = theme === val;
              return (
                <button
                  key={val}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => void changeTheme(val)}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-xs font-semibold transition-all select-none ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30"
                      : "border-border/70 bg-card text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{label}</span>
                  {isActive && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 4: Efek Suara ── */}
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  audioEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {audioEnabled ? (
                  <Volume2 className="h-5 w-5" />
                ) : (
                  <VolumeX className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Efek Suara Kuis</p>
                <p className="text-xs text-muted-foreground">
                  Bunyi umpan balik saat menjawab benar, salah, dan lulus kuis.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={audioEnabled}
              aria-label="Aktifkan efek audio kuis"
              onClick={() => void changeAudio(!audioEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                audioEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span className="sr-only">Aktifkan efek audio kuis</span>
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  audioEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
