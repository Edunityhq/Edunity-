'use client';

import React, { useState } from 'react';
import { MOCK_TASKS } from '@/lib/data/admin';
import { MOCK_USERS } from '@/lib/auth/mock-users';
import { DenseTable } from '@/components/shared/DenseTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Clock, CheckCircle2 } from 'lucide-react';

export default function WeeklyTasksPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  // Filter tasks
  const filteredTasks = MOCK_TASKS.filter((task) => {
    const matchesStatus = statusFilter ? task.status === statusFilter : true;
    const matchesPriority = priorityFilter ? task.priority === priorityFilter : true;
    return matchesStatus && matchesPriority;
  });

  // Get assignee name
  const getAssigneeName = (userId: string) => {
    const user = MOCK_USERS.find((u) => u.id === userId);
    return user?.name || 'Unknown';
  };

  // Prepare table rows
  const tableRows = filteredTasks.map((task) => ({
    title: task.title,
    assignedTo: getAssigneeName(task.assignedTo),
    dueDate: new Date(task.dueDate).toLocaleDateString(),
    status: <StatusBadge status={task.status} />,
    priority: <StatusBadge status={task.priority} />,
    description: task.description,
  }));

  // Get status stats
  const stats = {
    total: MOCK_TASKS.length,
    pending: MOCK_TASKS.filter((t) => t.status === 'pending').length,
    inProgress: MOCK_TASKS.filter((t) => t.status === 'in-progress').length,
    completed: MOCK_TASKS.filter((t) => t.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Weekly Tasks</h1>
          <p className="text-sm text-ink-500 mt-1">
            Manage and track team assignments.
          </p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 sm:grid-cols-4">
        <div className="bg-white border border-ink-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-ink-500 uppercase mb-1">Total Tasks</div>
          <div className="text-2xl font-bold text-ink-900">{stats.total}</div>
        </div>
        <div className="bg-white border border-ink-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-ink-500 uppercase mb-1">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white border border-ink-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-ink-500 uppercase mb-1">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
        </div>
        <div className="bg-white border border-ink-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-ink-500 uppercase mb-1">Completed</div>
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-ink-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-ink-900 mb-1.5">
              Filter by Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-ink-200 rounded-lg text-ink-900 focus:outline-none focus:ring-1 focus:ring-red-600"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-sm font-medium text-ink-900 mb-1.5">
              Filter by Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-2 border border-ink-200 rounded-lg text-ink-900 focus:outline-none focus:ring-1 focus:ring-red-600"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-ink-500">
          Showing {filteredTasks.length} of {MOCK_TASKS.length} tasks
        </div>
      </div>

      {/* Table */}
      <div>
        <DenseTable
          columns={[
            { label: 'Title', key: 'title', width: '25%' },
            { label: 'Assigned To', key: 'assignedTo', width: '20%', hideOnMobile: true },
            { label: 'Due Date', key: 'dueDate', width: '15%', hideOnMobile: true },
            { label: 'Status', key: 'status', width: '15%' },
            { label: 'Priority', key: 'priority', width: '15%' },
            { label: 'Description', key: 'description', width: '10%', hideOnMobile: true },
          ]}
          rows={tableRows}
        />
      </div>
    </div>
  );
}
