import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { Role } from '@/lib/types';

/**
 * Hook to protect routes - redirects to login if not authenticated
 * Also optionally checks for specific role
 */
export function useProtectedRoute(allowedRoles?: Role[]) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      router.push('/login');
      return;
    }
  }, [isAuthenticated, user, isLoading, allowedRoles, router]);

  return {
    isLoading,
    isAuthenticated,
    user,
    hasAccess: !isLoading && isAuthenticated && (!allowedRoles || !user || allowedRoles.includes(user.role)),
  };
}

/**
 * Client component wrapper for protected routes
 */
export function ProtectedRoute({
  children,
  allowedRoles,
  fallback,
}: {
  children: React.ReactNode;
  allowedRoles?: Role[];
  fallback?: React.ReactNode;
}) {
  const { isLoading, hasAccess } = useProtectedRoute(allowedRoles);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!hasAccess) {
    return fallback || <div className="flex items-center justify-center h-screen">Access Denied</div>;
  }

  return <>{children}</>;
}
