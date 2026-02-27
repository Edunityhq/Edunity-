'use client';

import React, { useState } from 'react';
import { DenseTable } from '@/components/shared/DenseTable';
import { mockSchools } from '@/lib/data/mock';

export default function SchoolsPage() {
  const [schools] = useState(mockSchools);

  const schoolRows = schools.map(s => ({
    name: s.name,
    contact: s.contactPerson,
    pipeline: <span className={`px-2 py-1 rounded text-xs font-medium ${
      s.pipeline === 'active' ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-800'
    }`}>{s.pipeline}</span>,
    requests: s.requestCount,
    lastTouched: new Date(s.lastTouched).toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Schools CRM</h1>
        <p className="text-sm text-neutral-500 mt-1">Sales partnerships and onboarding tracking</p>
      </div>

      <button className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded font-medium text-sm hover:opacity-90">
        + New School
      </button>

      <DenseTable
        columns={[
          { label: 'School', key: 'name', width: '30%' },
          { label: 'Contact', key: 'contact', width: '25%' },
          { label: 'Pipeline', key: 'pipeline', width: '15%' },
          { label: 'Requests', key: 'requests', width: '10%' },
          { label: 'Last Touched', key: 'lastTouched', width: '20%' },
        ]}
        rows={schoolRows}
      />
    </div>
  );
}
