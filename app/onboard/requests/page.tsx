'use client';

import React, { useState } from 'react';
import { List, Grid3x3, X } from 'lucide-react';
import { DenseTable } from '@/components/shared/DenseTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { mockRequests } from '@/lib/data/mock';

export default function RequestsPage() {
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const statuses = ['New', 'In Review', 'Matched', 'In Progress', 'Completed'];

  const requestRows = mockRequests.map(r => ({
    subject: r.subject,
    requester: r.requester,
    location: r.location,
    status: <StatusBadge status={r.status} />,
    priority: <span className={`px-2 py-1 rounded text-xs font-medium ${
      r.priority === 'high' ? 'bg-orange-100 text-orange-800' : 'bg-neutral-100 text-neutral-800'
    }`}>{r.priority}</span>,
    date: new Date(r.createdDate).toLocaleDateString(),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">School/Parent Requests</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage tutoring requests and matches</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded ${viewMode === 'table' ? 'bg-[hsl(var(--primary))] text-white' : 'bg-neutral-100 text-neutral-900'}`}
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-2 rounded ${viewMode === 'kanban' ? 'bg-[hsl(var(--primary))] text-white' : 'bg-neutral-100 text-neutral-900'}`}
          >
            <Grid3x3 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <DenseTable
          columns={[
            { label: 'Subject', key: 'subject', width: '20%' },
            { label: 'Requester', key: 'requester', width: '20%', hideOnMobile: true },
            { label: 'Location', key: 'location', width: '20%', hideOnMobile: true },
            { label: 'Status', key: 'status', width: '15%' },
            { label: 'Priority', key: 'priority', width: '12%' },
            { label: 'Date', key: 'date', width: '13%', hideOnMobile: true },
          ]}
          rows={requestRows}
          onRowClick={(row) => setSelectedRequest(mockRequests.find(r => r.subject === row.subject))}
        />
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {statuses.map(status => {
            const cards = mockRequests.filter(r => r.status === status.toLowerCase().replace(' ', '-'));
            return (
              <div key={status} className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
                <p className="font-semibold text-sm text-neutral-900 mb-3">{status} ({cards.length})</p>
                <div className="space-y-2">
                  {cards.map(card => (
                    <button
                      key={card.id}
                      onClick={() => setSelectedRequest(card)}
                      className="w-full text-left p-3 bg-white rounded border border-neutral-200 hover:border-[hsl(var(--primary))] hover:shadow-sm transition-all"
                    >
                      <p className="text-sm font-medium text-neutral-900 line-clamp-2">{card.subject}</p>
                      <p className="text-xs text-neutral-500 mt-1">{card.requester}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Request Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full max-w-md p-6 rounded-t-lg shadow-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-neutral-900">Request Details</h2>
              <button onClick={() => setSelectedRequest(null)} className="text-neutral-500 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Subject</p>
                <p className="text-sm font-medium text-neutral-900">{selectedRequest.subject}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Requester</p>
                <p className="text-sm text-neutral-900">{selectedRequest.requester}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Location</p>
                  <p className="text-sm text-neutral-900">{selectedRequest.location}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Status</p>
                  <StatusBadge status={selectedRequest.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Notes</p>
                <textarea
                  className="w-full mt-2 p-3 text-sm bg-neutral-50 border border-neutral-200 rounded text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  placeholder="Add notes..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button className="flex-1 px-3 py-2 bg-[hsl(var(--primary))] text-white rounded font-medium text-sm hover:opacity-90">
                  Assign Ops
                </button>
                <button className="flex-1 px-3 py-2 bg-neutral-100 text-neutral-900 rounded font-medium text-sm hover:bg-neutral-200">
                  Propose Match
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
