'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { DenseTable } from '@/components/shared/DenseTable'
import { getDb } from '@/lib/firebase'

type AuditRow = {
  id: string
  activityType: string
  userName: string
  message: string
  teamOwner: string
  createdAt: string
}

function toDate(value: unknown) {
  if (!value) return null
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate()
  const next = new Date(value as string)
  return Number.isNaN(next.getTime()) ? null : next
}

export default function AuditPage() {
  const [loading, setLoading] = useState(true)
  const [queryText, setQueryText] = useState('')
  const [rows, setRows] = useState<AuditRow[]>([])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(query(collection(getDb(), 'lead_activity_log'), orderBy('createdAt', 'desc'), limit(200)))
        setRows(
          snap.docs.map((row) => {
            const data = row.data() as Record<string, unknown>
            return {
              id: row.id,
              activityType: typeof data.activityType === 'string' ? data.activityType.replace(/_/g, ' ') : 'NOTE',
              userName: typeof data.userName === 'string' ? data.userName : 'System',
              message: typeof data.message === 'string' ? data.message : 'Activity updated.',
              teamOwner: typeof data.teamOwner === 'string' ? data.teamOwner : '-',
              createdAt: toDate(data.createdAt)?.toLocaleString() ?? '-',
            }
          })
        )
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const filteredRows = useMemo(() => {
    const term = queryText.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) => [row.activityType, row.userName, row.message, row.teamOwner].join(' ').toLowerCase().includes(term))
  }, [queryText, rows])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Audit Log</h1>
        <p className="text-sm text-neutral-500 mt-1">Lead creation, routing, assignment, and status activity.</p>
      </div>

      <div className="rounded-lg border border-ink-200 bg-white p-4">
        <input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search user, action, message, or team" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
      </div>

      {loading ? (
        <div className="rounded-lg border border-ink-200 bg-white p-6 text-sm text-neutral-500">Loading audit activity...</div>
      ) : (
        <DenseTable
          columns={[
            { label: 'Action', key: 'activityType', width: '16%' },
            { label: 'User', key: 'userName', width: '16%' },
            { label: 'Message', key: 'message', width: '38%' },
            { label: 'Team', key: 'teamOwner', width: '12%', hideOnMobile: true },
            { label: 'Timestamp', key: 'createdAt', width: '18%', hideOnMobile: true },
          ]}
          rows={filteredRows}
        />
      )}
    </div>
  )
}
