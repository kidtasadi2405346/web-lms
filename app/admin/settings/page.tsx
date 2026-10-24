import { requireRole } from "@/lib/auth";
import { SettingsView } from "@/components/layout/settings-view";

export default async function AdminSettingsPage() {
  const profile = await requireRole("admin");
  return <SettingsView profile={profile} />;
}
