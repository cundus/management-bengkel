import { requireUser } from "@/lib/auth";
import { getCounts } from "@/lib/queries/finance";
import { getDashboardData } from "@/lib/queries/dashboard";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { DesktopHeader, MobileHeader } from "@/components/shell/app-header";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [dashboard, counts] = await Promise.all([getDashboardData(), getCounts()]);

  return (
    <div className="min-h-dvh">
      <Sidebar
        user={user}
        outstandingCount={counts.outstandingTransactions}
        lowStockCount={counts.lowStock}
      />
      <div className="min-h-dvh lg:pl-[268px]">
        <MobileHeader user={user} today={dashboard.today} overdueCount={dashboard.receivables.overdueCount} />
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 lg:px-9 lg:pb-10 lg:pt-6">
          <DesktopHeader user={user} today={dashboard.today} />
          {children}
        </div>
      </div>
      <BottomNav outstandingCount={dashboard.receivables.overdueCount} />
    </div>
  );
}
