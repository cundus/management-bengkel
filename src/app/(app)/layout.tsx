import { requireUser } from "@/lib/auth";
import { getNavigationSummary } from "@/lib/queries/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { DesktopHeader, MobileHeader } from "@/components/shell/app-header";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const summary = await getNavigationSummary();

  return (
    <div className="min-h-dvh">
      <Sidebar
        user={user}
        outstandingCount={summary.outstanding}
        lowStockCount={summary.lowStock}
        voidRequestCount={user.role === "owner" ? summary.voidRequests : 0}
      />
      <div className="min-h-dvh lg:pl-[268px]">
        <MobileHeader user={user} today={summary.today} overdueCount={summary.overdue} />
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 lg:px-9 lg:pb-10 lg:pt-6">
          <DesktopHeader user={user} today={summary.today} />
          {children}
        </div>
      </div>
      <BottomNav outstandingCount={summary.overdue} voidRequestCount={user.role === "owner" ? summary.voidRequests : 0} />
    </div>
  );
}
