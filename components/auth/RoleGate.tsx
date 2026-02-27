'use client';

import React from 'react';
import { useRole } from './RoleProvider';
import type { Role } from '@/lib/types';

interface RoleGateProps {
  allowedRoles: Role | Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ allowedRoles, children, fallback }: RoleGateProps) {
  const { hasRole } = useRole();

  if (!hasRole(allowedRoles)) {
    return fallback || null;
  }

  return children;
}
