import React from 'react';
import { AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title = 'No Access',
  description = "You don't have permission to view this page.",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 p-8">
      <div className="text-center max-w-sm">
        {icon || <AlertCircle className="w-12 h-12 text-ink-400 mx-auto mb-4" />}
        <h2 className="text-lg font-semibold text-ink-900 mb-2">{title}</h2>
        <p className="text-sm text-ink-500 mb-6">{description}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="px-4 py-2 bg-red-600 text-white rounded font-medium text-sm hover:bg-red-700 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
