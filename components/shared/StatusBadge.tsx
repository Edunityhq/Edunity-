import React from 'react';

export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<
    string,
    { bg: string; text: string; label: string }
  > = {
    // Requests
    pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Pending' },
    assigned: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Assigned' },
    'in-progress': { bg: 'bg-blue-50', text: 'text-blue-700', label: 'In Progress' },
    completed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Completed' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-700', label: 'Cancelled' },

    // Verification
    approved: { bg: 'bg-green-50', text: 'text-green-700', label: 'Approved' },
    rejected: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
    expired: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Expired' },

    // Payouts
    processing: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Processing' },
    failed: { bg: 'bg-red-50', text: 'text-red-700', label: 'Failed' },

    // Support tickets
    open: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Open' },
    resolved: { bg: 'bg-green-50', text: 'text-green-700', label: 'Resolved' },
    closed: { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Closed' },

    // Availability
    available: { bg: 'bg-green-50', text: 'text-green-700', label: 'Available' },
    limited: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Limited' },
    full: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Full' },

    // Active/Inactive
    active: { bg: 'bg-green-50', text: 'text-green-700', label: 'Active' },
    inactive: { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Inactive' },

    // Verified
    verified: { bg: 'bg-green-50', text: 'text-green-700', label: '✓ Verified' },
    unverified: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Unverified' },
  };

  const config = statusConfig[status.toLowerCase()] || {
    bg: 'bg-ink-50',
    text: 'text-ink-700',
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
