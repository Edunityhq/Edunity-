'use client';

import React from 'react';
import { KPITile } from '@/components/shared/KPITile';
import { DenseTable } from '@/components/shared/DenseTable';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { MOCK_TASKS, MOCK_AUDIT_LOGS } from '@/lib/data/admin';
import { Users, CheckCircle, AlertCircle, Clock } from 'lucide-react';

export default function AdminDashboardPage() {
  // KPIs for admin
  const kpis = [
    {
      label: 'Total Staff',
      value: 24,
      unit: 'members',
      change: 2,
      changeType: 'positive' as const,
      icon: <Users className="w-5 h-5" />,
    },
    {
      label: 'Pending Tasks',
      value: 8,
      unit: 'tasks',
      change: -2,
      changeType: 'negative' as const,
      icon: <Clock className="w-5 h-5" />,
    },
    {
      label: 'Completed Tasks',
      value: 156,
      unit: 'this month',
      change: 12,
      changeType: 'positive' as const,
      icon: <CheckCircle className="w-5 h-5" />,
    },
    {
      label: 'System Health',
      value: '99.8',
      unit: '%',
      change: 0,
      changeType: 'neutral' as const,
      icon: <AlertCircle className="w-5 h-5" />,
    },
  ];

  // Format task data for table
  const taskRows = MOCK_TASKS.map((task) => ({
    title: task.title,
    assignedTo: task.assignedTo === '4' ? 'Zainab Hassan' : task.assignedTo === '5' ? 'Oluwaseun Adekunle' : task.assignedTo === '2' ? 'Chisom Okafor' : task.assignedTo === '6' ? 'Adeola Ibraheem' : 'Unknown',
    dueDate: new Date(task.dueDate).toLocaleDateString(),
    status: task.status.charAt(0).toUpperCase() + task.status.slice(1),
    priority: task.priority.charAt(0).toUpperCase() + task.priority.slice(1),
  }));

  // Format audit log data for feed
  const activities = MOCK_AUDIT_LOGS.slice(0, 5).map((log) => ({
    id: log.id,
    user: log.userName,
    action: `${log.action} ${log.resourceName}`,
    target: log.resource,
    timestamp: new Date(log.timestamp).toLocaleTimeString(),
    details: log.details,
  }));

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#4A0000]">Admin Control Panel</h1>
        <p className="text-sm text-[#4A0000]/70 mt-1">
          Manage staff, tasks, and system settings.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-3 md:gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Tasks and Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div>
            <h2 className="text-lg font-semibold text-[#4A0000] mb-4">Assigned Tasks</h2>
            <DenseTable
              columns={[
                { label: 'Title', key: 'title', width: '35%' },
                { label: 'Assigned To', key: 'assignedTo', width: '20%', hideOnMobile: true },
                { label: 'Due Date', key: 'dueDate', width: '20%', hideOnMobile: true },
                { label: 'Status', key: 'status', width: '15%' },
                { label: 'Priority', key: 'priority', width: '10%' },
              ]}
              rows={taskRows}
            />
          </div>
        </div>
        <ActivityFeed activities={activities} />
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-[#C4C3D0] rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[#4A0000] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button className="px-4 py-3 bg-[#4A0000] hover:bg-[#630000] text-white font-medium text-sm rounded transition">
            Add Staff
          </button>
          <button className="px-4 py-3 bg-[#4A0000] hover:bg-[#630000] text-white font-medium text-sm rounded transition">
            Create Task
          </button>
          <button className="px-4 py-3 bg-[#4A0000] hover:bg-[#630000] text-white font-medium text-sm rounded transition">
            View Audit Log
          </button>
        </div>
      </div>
    </div>
  );
}
