import { AppHeader } from "@/components/app-header";
import { PageTitleSync } from "@/components/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <PageTitleSync />
      <AppHeader />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
