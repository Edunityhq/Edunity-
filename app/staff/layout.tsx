'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useProtectedRoute } from '@/lib/auth/use-protected-route';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, hasAccess } = useProtectedRoute(['admin']);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm text-muted-foreground">Loading staff pages...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm text-muted-foreground">Access denied.</div>
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
