import { AppShell } from "@/components/app-shell";
import { requireStudio } from "@/lib/auth";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const studio = await requireStudio();
  return (
    <AppShell studioName={studio.name} plan={studio.plan}>
      {children}
    </AppShell>
  );
}
