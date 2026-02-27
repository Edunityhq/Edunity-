'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TemplatesPage() {
  const [templates] = useState([
    { id: 1, name: 'First Contact - Tutor', type: 'message', platform: 'WhatsApp' },
    { id: 2, name: 'Verification Reminder', type: 'message', platform: 'Email' },
    { id: 3, name: 'Match Proposal', type: 'message', platform: 'WhatsApp' },
  ]);

  const [sops] = useState([
    { id: 1, name: 'Tutor Verification SOP', category: 'Verification' },
    { id: 2, name: 'Match Escalation', category: 'Matching' },
    { id: 3, name: 'Payout Dispute Resolution', category: 'Finance' },
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Templates & SOPs</h1>
        <p className="text-sm text-neutral-500 mt-1">Message scripts, SOPs, and checklists for scaling</p>
      </div>

      <Tabs defaultValue="messages" className="w-full">
        <TabsList>
          <TabsTrigger value="messages">Message Templates</TabsTrigger>
          <TabsTrigger value="sops">SOPs & Checklists</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-4">
          <button className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded font-medium text-sm hover:opacity-90">
            + New Template
          </button>
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="p-4 bg-neutral-50 border border-neutral-200 rounded hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">{t.name}</p>
                    <p className="text-xs text-neutral-500 mt-1">{t.platform}</p>
                  </div>
                  <span className="text-xs bg-neutral-200 text-neutral-900 px-2 py-1 rounded">{t.type}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sops" className="space-y-4">
          <button className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded font-medium text-sm hover:opacity-90">
            + New SOP
          </button>
          <div className="space-y-2">
            {sops.map(s => (
              <div key={s.id} className="p-4 bg-neutral-50 border border-neutral-200 rounded hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-neutral-900">{s.name}</p>
                    <p className="text-xs text-neutral-500 mt-1">{s.category}</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-900 px-2 py-1 rounded">SOP</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
