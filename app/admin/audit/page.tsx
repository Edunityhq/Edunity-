'use client';

import React, { useState } from 'react';
import { DenseTable } from '@/components/shared/DenseTable';
import { Search } from 'lucide-react';

export default function AuditPage() {
  const auditRows = [
    { action: 'Tutor verified', user: 'Grace Okonkwo', timestamp: '2024-01-13 14:23', details: 'Chisom O. approved' },
    { action: 'Match created', user: 'Ade Oguntunde', timestamp: '2024-01-13 13:45', details: 'Lekki VI School' },
    { action: 'Payout processed', user: 'Admin', timestamp: '2024-01-13 11:00', details: '₦45,000 to Adeola A.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Audit Log</h1>
        <p className="text-sm text-neutral-500 mt-1">System activity and compliance tracking</p>
      </div>

      <DenseTable
        columns={[
          { label: 'Action', key: 'action', width: '20%' },
          { label: 'User', key: 'user', width: '20%' },
          { label: 'Timestamp', key: 'timestamp', width: '20%', hideOnMobile: true },
          { label: 'Details', key: 'details', width: '40%' },
        ]}
        rows={auditRows}
      />
    </div>
  );
}
