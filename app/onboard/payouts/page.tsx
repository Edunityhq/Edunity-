'use client';

import React, { useState } from 'react';
import { DenseTable } from '@/components/shared/DenseTable';
import { mockPayouts } from '@/lib/data/mock';

export default function PayoutsPage() {
  const [payouts] = useState(mockPayouts);

  const payoutRows = payouts.map(p => ({
    tutor: p.tutor,
    amount: `₦${p.amount.toLocaleString()}`,
    period: p.period,
    status: <span className={`px-2 py-1 rounded text-xs font-medium ${
      p.status === 'paid' ? 'bg-green-100 text-green-800' : 
      p.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
      'bg-red-100 text-red-800'
    }`}>{p.status}</span>,
    date: new Date(p.payoutDate).toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Payouts</h1>
          <p className="text-sm text-neutral-500 mt-1">Finance console: status, disputes, holds</p>
        </div>
        <button className="px-4 py-2 bg-neutral-100 text-neutral-900 rounded font-medium text-sm hover:bg-neutral-200">
          Export
        </button>
      </div>

      <DenseTable
        columns={[
          { label: 'Tutor', key: 'tutor', width: '25%' },
          { label: 'Amount', key: 'amount', width: '20%' },
          { label: 'Period', key: 'period', width: '15%' },
          { label: 'Status', key: 'status', width: '15%' },
          { label: 'Date', key: 'date', width: '25%' },
        ]}
        rows={payoutRows}
      />
    </div>
  );
}
