'use client';

import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { DenseTable } from '@/components/shared/DenseTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { mockTeachers } from '@/lib/data/mock';

export default function TutorsPage() {
  const [selectedTutor, setSelectedTutor] = useState<any>(null);
  const [filters, setFilters] = useState({ status: '', subject: '', search: '' });

  const tutorRows = mockTeachers
    .filter(t => {
      if (filters.status && t.availability !== filters.status) return false;
      if (filters.subject && t.subject !== filters.subject) return false;
      if (filters.search && !t.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    })
    .map(t => ({
      name: t.name,
      subject: t.subject,
      status: <StatusBadge status={t.verified ? 'approved' : 'pending'} />,
      availability: t.availability,
      rating: `${t.rating}/5`,
      rate: `₦${t.hourlyRate}/hr`,
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Tutors Pipeline</h1>
          <p className="text-sm text-neutral-500 mt-1">Core tutor management and verification</p>
        </div>
        <button className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded font-medium text-sm hover:opacity-90">
          + New Tutor
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            value={filters.search}
            onChange={e => setFilters({...filters, search: e.target.value})}
          />
        </div>
        <select
          className="px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded text-neutral-900 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          value={filters.status}
          onChange={e => setFilters({...filters, status: e.target.value})}
        >
          <option value="">All Status</option>
          <option value="Available">Available</option>
          <option value="Limited">Limited</option>
        </select>
      </div>

      {/* Table */}
      <DenseTable
        columns={[
          { label: 'Name', key: 'name', width: '25%' },
          { label: 'Subject', key: 'subject', width: '20%' },
          { label: 'Status', key: 'status', width: '15%' },
          { label: 'Availability', key: 'availability', width: '15%' },
          { label: 'Rating', key: 'rating', width: '12%' },
          { label: 'Rate', key: 'rate', width: '13%' },
        ]}
        rows={tutorRows}
        onRowClick={(row) => setSelectedTutor(mockTeachers.find(t => t.name === row.name))}
      />

      {/* Tutor Drawer */}
      {selectedTutor && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white w-full max-w-md p-6 rounded-t-lg shadow-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-neutral-900">Tutor Profile</h2>
              <button onClick={() => setSelectedTutor(null)} className="text-neutral-500 hover:text-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Name</p>
                <p className="text-sm font-medium text-neutral-900">{selectedTutor.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Subject</p>
                  <p className="text-sm text-neutral-900">{selectedTutor.subject}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500">Rating</p>
                  <p className="text-sm text-neutral-900">{selectedTutor.rating}/5.0</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Hourly Rate</p>
                <p className="text-sm text-neutral-900">₦{selectedTutor.hourlyRate}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500">Availability</p>
                <p className="text-sm text-neutral-900">{selectedTutor.availability}</p>
              </div>
              <div className="flex gap-2 pt-4">
                <button className="flex-1 px-3 py-2 bg-[hsl(var(--primary))] text-white rounded font-medium text-sm hover:opacity-90">
                  Assign to HR
                </button>
                <button className="flex-1 px-3 py-2 bg-neutral-100 text-neutral-900 rounded font-medium text-sm hover:bg-neutral-200">
                  Flag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
