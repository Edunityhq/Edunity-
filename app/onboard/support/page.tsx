'use client';

import React, { useState } from 'react';
import { DenseTable } from '@/components/shared/DenseTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { mockTickets } from '@/lib/data/mock';

export default function SupportPage() {
  const [tickets] = useState(mockTickets);

  const ticketRows = tickets.map(t => ({
    id: `#${t.id}`,
    subject: t.subject,
    category: t.category,
    priority: <span className={`px-2 py-1 rounded text-xs font-medium ${
      t.priority === 'urgent' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-800'
    }`}>{t.priority}</span>,
    status: <StatusBadge status={t.status} />,
    created: new Date(t.createdAt).toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Support Queue</h1>
        <p className="text-sm text-neutral-500 mt-1">Tickets linked to tutor, request, school, or payout</p>
      </div>

      <DenseTable
        columns={[
          { label: 'Ticket', key: 'id', width: '10%' },
          { label: 'Subject', key: 'subject', width: '35%' },
          { label: 'Category', key: 'category', width: '15%', hideOnMobile: true },
          { label: 'Priority', key: 'priority', width: '12%' },
          { label: 'Status', key: 'status', width: '12%' },
          { label: 'Created', key: 'created', width: '16%', hideOnMobile: true },
        ]}
        rows={ticketRows}
      />
    </div>
  );
}
