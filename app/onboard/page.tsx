'use client';

import React from 'react';
import { KPITile } from '@/components/shared/KPITile';
import { DenseTable } from '@/components/shared/DenseTable';
import { TrendChart } from '@/components/shared/TrendChart';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { useAuth } from '@/lib/auth/auth-context';
import { mockActivity } from '@/lib/data/mock';
import { Users, ListTodo, CheckCircle, AlertCircle } from 'lucide-react';

export default function OnboardOverviewPage() {
  const { user } = useAuth();

  const trendingData = [
    { week: 'Week 1', signups: 12, matches: 8, verified: 5 },
    { week: 'Week 2', signups: 18, matches: 14, verified: 11 },
    { week: 'Week 3', signups: 15, matches: 12, verified: 9 },
    { week: 'Week 4', signups: 22, matches: 18, verified: 16 },
  ];

  const kpis = [
    { label: 'New Tutor Signups', value: 127, unit: 'this week', change: 12, changeType: 'positive' as const, icon: <Users className="w-5 h-5" /> },
    { label: 'Pending Verifications', value: 23, unit: 'in queue', change: -5, changeType: 'negative' as const, icon: <CheckCircle className="w-5 h-5" /> },
    { label: 'Matches Pending', value: 18, unit: 'awaiting contact', change: 8, changeType: 'positive' as const, icon: <ListTodo className="w-5 h-5" /> },
    { label: 'Critical Alerts', value: 3, unit: 'needs action', change: 1, changeType: 'neutral' as const, icon: <AlertCircle className="w-5 h-5" /> },
  ];

  const todayQueue = [
    { id: 1, task: 'Review tutor docs - Chisom O.', priority: 'high', status: 'pending' },
    { id: 2, task: 'Contact matched school - Lekki Branch', priority: 'high', status: 'pending' },
    { id: 3, task: 'Resolve payout dispute - Adeola A.', priority: 'urgent', status: 'pending' },
    { id: 4, task: 'Follow up on stalled match - Mr. Babs', priority: 'medium', status: 'in-progress' },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Mission Control</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Today's onboarding status and critical queue
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, idx) => (
          <KPITile
            key={idx}
            label={kpi.label}
            value={kpi.value}
            unit={kpi.unit}
            change={kpi.change}
            changeType={kpi.changeType}
            icon={kpi.icon}
          />
        ))}
      </div>

      {/* Trend Chart & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TrendChart
            data={trendingData}
            dataKey="signups"
            xAxisKey="week"
            title="Weekly Signups & Verifications"
            height={280}
          />
        </div>
        <ActivityFeed activities={mockActivity.slice(0, 5)} />
      </div>

      {/* Today's Queue */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Today's Queue - Must Touch</h2>
        <DenseTable
          columns={[
            { label: 'Task', key: 'task', width: '50%' },
            { label: 'Priority', key: 'priority', width: '20%' },
            { label: 'Status', key: 'status', width: '30%' },
          ]}
          rows={todayQueue.map(q => ({
            task: q.task,
            priority: <span className={`px-2 py-1 rounded text-xs font-medium ${
              q.priority === 'urgent' ? 'bg-[hsl(var(--primary))] text-white' :
              q.priority === 'high' ? 'bg-orange-100 text-orange-800' :
              'bg-neutral-100 text-neutral-800'
            }`}>{q.priority}</span>,
            status: <span className={`text-xs ${q.status === 'pending' ? 'text-red-600' : 'text-blue-600'}`}>{q.status}</span>,
          }))}
        />
      </div>
    </div>
  );
}
