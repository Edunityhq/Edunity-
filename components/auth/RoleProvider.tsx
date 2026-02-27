'use client';

import React, { createContext, useContext, useState } from 'react';
import type { Role, User } from '@/lib/types';

interface RoleContextType {
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  currentUser: User;
  hasRole: (role: Role | Role[]) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const DEFAULT_USER: User = {
  id: 'user-1',
  name: 'Adaeze Obi',
  email: 'adaeze@edunity.com',
  role: 'admin',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Adaeze',
};

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRole] = useState<Role>(DEFAULT_USER.role);

  const currentUser: User = {
    ...DEFAULT_USER,
    role: currentRole,
  };

  const hasRole = (roles: Role | Role[]): boolean => {
    if (typeof roles === 'string') {
      return currentRole === roles;
    }
    return roles.includes(currentRole);
  };

  return (
    <RoleContext.Provider value={{ currentRole, setCurrentRole, currentUser, hasRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
