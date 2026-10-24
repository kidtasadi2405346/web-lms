import { requireRole } from "@/lib/auth";
import { SettingsView } from "@/components/layout/settings-view";

export default async function StudentSettingsPage() {
  const profile = await requireRole("student");
  return <SettingsView profile={profile} />;
}
