"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { updateProfilePreferencesAction, type ThemePreference } from "@/lib/actions/profile";
import type { Profile } from "@/lib/types";
import { ROLE_HOME } from "@/lib/roles";
import type { Role } from "@/lib/roles";

const THEME_KEY = "mini-lms-theme";
const AUDIO_KEY = "mini-lms-audio-enabled";

type ProfilePreferencesValue = {
  theme: ThemePreference;
  audioEnabled: boolean;
  setTheme: (theme: ThemePreference) => Promise<string | null>;
  setAudioEnabled: (enabled: boolean) => Promise<string | null>;
};

const ProfilePreferencesContext = createContext<ProfilePreferencesValue>({
  theme: "system",
  audioEnabled: true,
  setTheme: async () => null,
  setAudioEnabled: async () => null,
});

export function useProfilePreferences() {
  return useContext(ProfilePreferencesContext);
}

function applyTheme(theme: ThemePreference) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
}

export function ProfilePreferencesProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemePreference>(profile.theme ?? "system");
  const [audioEnabled, setAudioEnabledState] = useState(profile.audio_enabled ?? true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let storedTheme: ThemePreference | null = null;
    let storedAudio: boolean | null = null;
    try {
      const themeValue = window.localStorage.getItem(THEME_KEY);
      if (themeValue === "light" || themeValue === "dark" || themeValue === "system") {
        storedTheme = themeValue;
      }
      const audioValue = window.localStorage.getItem(AUDIO_KEY);
      if (audioValue === "true" || audioValue === "false") {
        storedAudio = audioValue === "true";
      }
    } catch {
      // Server-rendered preferences remain available when local storage is disabled.
    }

    if (storedTheme) setThemeState(storedTheme);
    applyTheme(storedTheme ?? profile.theme ?? "system");
    if (storedAudio !== null) setAudioEnabledState(storedAudio);
    setInitialized(true);
  }, [profile.audio_enabled, profile.theme]);

  useEffect(() => {
    if (!initialized) return;
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // The profile remains the durable source when local storage is unavailable.
    }
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => applyTheme("system");
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [initialized, theme]);

  useEffect(() => {
    if (!initialized) return;
    try {
      window.localStorage.setItem(AUDIO_KEY, String(audioEnabled));
    } catch {
      // Audio preferences still work for this session when storage is unavailable.
    }
  }, [audioEnabled, initialized]);

  const setTheme = useCallback(async (nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // Persist to the profile below even when browser storage is disabled.
    }
    const result = await updateProfilePreferencesAction({ theme: nextTheme });
    return result.error ?? null;
  }, []);

  const setAudioEnabled = useCallback(async (enabled: boolean) => {
    setAudioEnabledState(enabled);
    try {
      window.localStorage.setItem(AUDIO_KEY, String(enabled));
    } catch {
      // Persist to the profile below even when browser storage is disabled.
    }
    const result = await updateProfilePreferencesAction({ audio_enabled: enabled });
    return result.error ?? null;
  }, []);

  const value = useMemo(
    () => ({ theme, audioEnabled, setTheme, setAudioEnabled }),
    [theme, audioEnabled, setTheme, setAudioEnabled],
  );

  return (
    <ProfilePreferencesContext.Provider value={value}>
      {children}
    </ProfilePreferencesContext.Provider>
  );
}

/**
 * Tautan "Pengaturan Akun" di sidebar yang mengarah ke halaman pengaturan penuh.
 * Tampil aktif saat pathname cocok dengan href pengaturan.
 */
export function SettingsLink({ role }: { role: Role }) {
  const href = `${ROLE_HOME[role]}/settings`;
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 h-9 text-xs font-medium transition-all duration-150 ${
        isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/80"
      }`}
    >
      <Settings className="h-4 w-4 shrink-0" />
      <span className="truncate">Pengaturan Akun</span>
    </Link>
  );
}