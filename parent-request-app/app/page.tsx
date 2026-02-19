'use client'

import { CSSProperties, FormEvent, useState } from 'react'
import { addDoc, collection, doc, getDocs, limit, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

type FormState = {
  parentFullName: string
  parentPhone: string
  parentEmail: string
  learnerName: string
  state: string
  lga: string
  requestedSubjects: string
  preferredSchedule: string
  additionalNotes: string
}

const initialForm: FormState = {
  parentFullName: '',
  parentPhone: '',
  parentEmail: '',
  learnerName: '',
  state: '',
  lga: '',
  requestedSubjects: '',
  preferredSchedule: '',
  additionalNotes: '',
}

const wrap: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
}

const card: CSSProperties = {
  width: '100%',
  maxWidth: 680,
  background: '#fff',
  borderRadius: 16,
  padding: 24,
  borderTop: '6px solid #4A0000',
}

function normalizeEmail(v: string) {
  return v.trim().toLowerCase()
}

function normalizePhone(v: string) {
  return v.replace(/\D/g, '')
}

async function checkDuplicateContact(email: string, phone: string) {
  const db = getDb()
  const checks = await Promise.all([
    getDocs(query(collection(db, 'parent_requests'), where('parentEmail', '==', email), limit(1))),
    getDocs(query(collection(db, 'parent_requests'), where('parentEmailNormalized', '==', email), limit(1))),
    getDocs(query(collection(db, 'parent_requests'), where('parentPhone', '==', phone), limit(1))),
    getDocs(query(collection(db, 'parent_requests'), where('parentPhoneNormalized', '==', phone), limit(1))),
  ])
  return {
    duplicateEmail: !checks[0].empty || !checks[1].empty,
    duplicatePhone: !checks[2].empty || !checks[3].empty,
  }
}

async function getNextParentRequestId() {
  const db = getDb()
  const counterRef = doc(db, 'counters', 'parent_request_serial')

  const serial = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    const current = snap.exists() ? Number((snap.data().current as number | undefined) ?? 100) : 100
    const next = Math.max(101, current + 1)
    tx.set(counterRef, { current: next, updatedAt: serverTimestamp() }, { merge: true })
    return next
  })

  return { edunityId: `ED-PR-${String(serial).padStart(5, '0')}`, edunityIdSerial: serial }
}

export default function Page() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setOk('')

    if (!form.parentFullName || !form.parentPhone || !form.parentEmail || !form.learnerName || !form.requestedSubjects) {
      setError('Please fill required fields.')
      return
    }

    setSubmitting(true)
    try {
      const parentEmailNormalized = normalizeEmail(form.parentEmail)
      const parentPhoneNormalized = normalizePhone(form.parentPhone)
      const dupe = await checkDuplicateContact(parentEmailNormalized, parentPhoneNormalized)
      if (dupe.duplicateEmail || dupe.duplicatePhone) {
        setError(dupe.duplicateEmail ? 'This email already has a request.' : 'This phone already has a request.')
        return
      }

      const { edunityId, edunityIdSerial } = await getNextParentRequestId()
      await addDoc(collection(getDb(), 'parent_requests'), {
        edunityId,
        edunityIdSerial,
        parentFullName: form.parentFullName.trim(),
        parentPhone: parentPhoneNormalized,
        parentPhoneNormalized,
        parentEmail: parentEmailNormalized,
        parentEmailNormalized,
        learnerName: form.learnerName.trim(),
        state: form.state.trim(),
        lga: form.lga.trim(),
        requestedSubjects: form.requestedSubjects
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredSchedule: form.preferredSchedule.trim(),
        additionalNotes: form.additionalNotes.trim(),
        status: 'new',
        createdAt: serverTimestamp(),
      })

      setOk('Parent request submitted successfully.')
      setForm(initialForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={wrap}>
      <form onSubmit={onSubmit} style={card}>
        <h1 style={{ marginTop: 0, color: '#4A0000' }}>Edunity Parent Request Form</h1>
        <p style={{ color: '#8A4B4B' }}>Standalone deploy for parent requests only.</p>

        <label>Parent Full Name *</label>
        <input value={form.parentFullName} onChange={(e) => setForm({ ...form, parentFullName: e.target.value })} style={{ width: '100%', height: 40, marginBottom: 12 }} />

        <label>Parent Phone *</label>
        <input value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} style={{ width: '100%', height: 40, marginBottom: 12 }} />

        <label>Parent Email *</label>
        <input type="email" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} style={{ width: '100%', height: 40, marginBottom: 12 }} />

        <label>Learner Name *</label>
        <input value={form.learnerName} onChange={(e) => setForm({ ...form, learnerName: e.target.value })} style={{ width: '100%', height: 40, marginBottom: 12 }} />

        <label>State</label>
        <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ width: '100%', height: 40, marginBottom: 12 }} />

        <label>LGA</label>
        <input value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} style={{ width: '100%', height: 40, marginBottom: 12 }} />

        <label>Requested Subjects (comma-separated) *</label>
        <input value={form.requestedSubjects} onChange={(e) => setForm({ ...form, requestedSubjects: e.target.value })} style={{ width: '100%', height: 40, marginBottom: 12 }} />

        <label>Preferred Schedule</label>
        <input value={form.preferredSchedule} onChange={(e) => setForm({ ...form, preferredSchedule: e.target.value })} style={{ width: '100%', height: 40, marginBottom: 12 }} />

        <label>Additional Notes</label>
        <textarea value={form.additionalNotes} onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })} style={{ width: '100%', minHeight: 90, marginBottom: 12 }} />

        {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
        {ok && <p style={{ color: '#166534' }}>{ok}</p>}

        <button type="submit" disabled={submitting} style={{ width: '100%', height: 44, background: '#4A0000', color: '#fff', border: 0, borderRadius: 8 }}>
          {submitting ? 'Submitting...' : 'Submit Parent Request'}
        </button>
      </form>
    </main>
  )
}
