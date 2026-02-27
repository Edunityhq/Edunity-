import React from 'react';
import type { Activity } from '@/lib/types';

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col p-4 rounded-lg border border-ink-200 bg-white">
      <h3 className="font-semibold text-sm text-ink-900 mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-3 text-xs">
            <div className="w-2 h-2 rounded-full bg-red-600 mt-1.5 flex-shrink-0"></div>
            <div className="flex-1 min-w-0">
              <p className="text-ink-900">
                <span className="font-medium">{activity.user}</span>
                {' '}
                <span className="text-ink-600">{activity.action}</span>
                {' '}
                <span className="font-medium text-ink-900">{activity.target}</span>
              </p>
              <p className="text-ink-500 mt-0.5">{formatTime(activity.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
