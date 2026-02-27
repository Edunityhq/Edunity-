'use client';

import React from 'react';
import { DenseTable } from '@/components/shared/DenseTable';
import { mockStaff } from '@/lib/data/mock';

export default function PeoplePage() {
  const staffRows = mockStaff.map(s => ({
    name: s.name,
    email: s.email,
    role: s.role,
    status: <span className={`px-2 py-1 rounded text-xs font-medium ${
      s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-800'
    }`}>{s.status}</span>,
    joinDate: new Date(s.joinDate).toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Staff Directory</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage team members and permissions</p>
        </div>
        <button className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded font-medium text-sm hover:opacity-90">
          + Add Member
        </button>
      </div>

      <DenseTable
        columns={[
          { label: 'Name', key: 'name', width: '25%' },
          { label: 'Email', key: 'email', width: '25%', hideOnMobile: true },
          { label: 'Role', key: 'role', width: '20%' },
          { label: 'Status', key: 'status', width: '15%' },
          { label: 'Joined', key: 'joinDate', width: '15%', hideOnMobile: true },
        ]}
        rows={staffRows}
      />
    </div>
  );
}
