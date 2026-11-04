import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/user/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/trips");
  return (
    <AppShell user={{ id: user.id, displayName: user.displayName, email: user.email }}>
      {children}
    </AppShell>
  );
}
