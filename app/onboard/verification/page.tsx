'use client';

import React, { useState } from 'react';
import { Check, X, FileStack } from 'lucide-react';
import { mockVerifications } from '@/lib/data/mock';

export default function VerificationPage() {
  const [selectedVerification, setSelectedVerification] = useState(mockVerifications[0]);
  const [filterStatus, setFilterStatus] = useState('pending');

  const pendingVerifications = mockVerifications.filter(v => v.status === filterStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Verification Queue</h1>
        <p className="text-sm text-neutral-500 mt-1">HR-first document review and approval</p>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Queue List */}
        <div className="lg:col-span-1">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                filterStatus === 'pending'
                  ? 'bg-[hsl(var(--primary))] text-white'
                  : 'bg-neutral-100 text-neutral-900'
              }`}
            >
              Pending ({mockVerifications.filter(v => v.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                filterStatus === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-neutral-100 text-neutral-900'
              }`}
            >
              Approved ({mockVerifications.filter(v => v.status === 'approved').length})
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pendingVerifications.map(verification => (
              <button
                key={verification.id}
                onClick={() => setSelectedVerification(verification)}
                className={`w-full text-left p-3 rounded border transition-colors ${
                  selectedVerification?.id === verification.id
                    ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
                    : 'bg-neutral-50 text-neutral-900 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                <p className="font-medium text-sm">{verification.name}</p>
                <p className={`text-xs mt-1 ${selectedVerification?.id === verification.id ? 'text-white/80' : 'text-neutral-500'}`}>
                  {verification.docType}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Detail Panel */}
        {selectedVerification && (
          <div className="lg:col-span-2">
            <div className="bg-neutral-50 rounded-lg p-6 border border-neutral-200">
              {/* Tutor Info */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-neutral-900">{selectedVerification.name}</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Uploaded: {new Date(selectedVerification.uploadDate).toLocaleDateString()}
                </p>
              </div>

              {/* Document Checklist */}
              <div className="space-y-3 mb-6">
                <p className="text-sm font-semibold text-neutral-900 uppercase">Required Documents</p>
                {['ID', 'Certificate', 'Insurance', 'Reference'].map(doc => (
                  <label key={doc} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm text-neutral-900">{doc}</span>
                  </label>
                ))}
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-neutral-900 mb-2 uppercase">Notes</label>
                <textarea
                  className="w-full p-3 text-sm bg-white border border-neutral-200 rounded text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
                  placeholder="Add review notes..."
                  rows={4}
                  defaultValue={selectedVerification.notes}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium text-sm hover:bg-green-700 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-medium text-sm hover:bg-red-700 flex items-center justify-center gap-2">
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
