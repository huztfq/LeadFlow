import { AppSidebar } from "@/components/app-sidebar";
import { PageTitleSync } from "@/components/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lf-shell lf-shell--app">
      <PageTitleSync />
      <AppSidebar />
      <main className="lf-main">{children}</main>
    </div>
  );
}
