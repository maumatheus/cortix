import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const uid = await getSessionUserId();
  if (!uid) redirect("/login");
  return <AppShell>{children}</AppShell>;
}
