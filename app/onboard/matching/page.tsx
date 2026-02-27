'use client';

import React, { useState } from 'react';
import { DenseTable } from '@/components/shared/DenseTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { mockMatches } from '@/lib/data/mock';

export default function MatchingPage() {
  const [matches] = useState(mockMatches);

  const matchRows = matches.map(m => ({
    tutor: m.tutor,
    request: m.request,
    score: `${m.score}%`,
    status: <StatusBadge status={m.status} />,
    distance: m.distance,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Match Pipeline</h1>
        <p className="text-sm text-neutral-500 mt-1">Ops console: proposed → contacted → accepted → scheduled → active</p>
      </div>

      <button className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded font-medium text-sm hover:opacity-90">
        + Manual Match
      </button>

      <DenseTable
        columns={[
          { label: 'Tutor', key: 'tutor', width: '25%' },
          { label: 'Request', key: 'request', width: '30%' },
          { label: 'Match Score', key: 'score', width: '15%' },
          { label: 'Status', key: 'status', width: '15%' },
          { label: 'Distance', key: 'distance', width: '15%' },
        ]}
        rows={matchRows}
      />
    </div>
  );
}
