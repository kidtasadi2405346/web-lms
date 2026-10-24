import { requireRole } from "@/lib/auth";
import { SettingsView } from "@/components/layout/settings-view";

export default async function TeacherSettingsPage() {
  const profile = await requireRole("teacher");
  return <SettingsView profile={profile} />;
}
