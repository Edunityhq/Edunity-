'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Check, Star } from 'lucide-react'
import { getAreasByStateLga, getLgasByState, getStates } from '@/data/locations'
import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  'Nursery / Early Years': [
    'Phonics / Reading Readiness',
    'Numeracy Foundations',
    'Handwriting',
    'Basic Science',
  ],
  'Primary (Years 1-6)': [
    'Mathematics',
    'English Language',
    'Basic Science',
    'Social Studies',
    'Verbal / Quantitative Reasoning',
    'ICT',
  ],
  'Junior Secondary (JSS 1-3)': [
    'Mathematics',
    'English Language',
    'Basic Science',
    'Basic Technology',
    'Business Studies',
    'Computer Studies / ICT',
  ],
  'Senior Secondary (SSS 1-3)': [
    'Mathematics',
    'English Language',
    'Physics',
    'Chemistry',
    'Biology',
    'Economics',
    'Government',
    'Literature in English',
    'Computer Studies / ICT',
  ],
  'IGCSE / Cambridge': [
    'Mathematics',
    'English Language',
    'Physics',
    'Chemistry',
    'Biology',
    'Economics',
    'ICT',
  ],
  'A-Levels': [
    'Mathematics',
    'Further Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Economics',
  ],
}

const EXAM_FOCUS = ['WAEC', 'NECO', 'JAMB', 'IGCSE', 'SAT', 'None']
const CLASS_RANGE = [
  'Nursery / Early Years',
  'Primary (Years 1-6)',
  'Junior Secondary (JSS 1-3)',
  'Senior Secondary (SSS 1-3)',
  'IGCSE / Cambridge',
  'A-Levels',
]

const LESSON_TYPES = ['Online', 'In-person', 'Both']
const PARENT_REQUESTS_STORAGE_KEY = 'edunity_parent_requests_v1'
const PARENT_REQUEST_API_TIMEOUT_MS = 4000

type ParentRequestFormData = {
  parentFullName: string
  parentPhone: string
  parentEmail: string
  relationshipToLearner: string
  learnerName: string
  numberOfLearners: string
  learnerClass: string
  state: string
  lga: string
  area: string
  requestedSubjects: string[]
  examFocus: string[]
  lessonType: string
  preferredSchedule: string
  urgency: string
  additionalNotes: string
  consent: boolean
  additionalLearners: Array<{ name: string; classLevel: string }>
}

export default function ParentRequestForm() {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState<ParentRequestFormData>({
    parentFullName: '',
    parentPhone: '',
    parentEmail: '',
    relationshipToLearner: '',
    learnerName: '',
    numberOfLearners: '',
    learnerClass: '',
    state: '',
    lga: '',
    area: '',
    requestedSubjects: [],
    examFocus: [],
    lessonType: '',
    preferredSchedule: '',
    urgency: '',
    additionalNotes: '',
    consent: false,
    additionalLearners: [],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const normalizeEmail = (email: string) => email.trim().toLowerCase()
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '')
  const isParentRequestHost = () => {
    if (typeof window === 'undefined') return false
    const host = window.location.hostname.toLowerCase()
    return host.includes('parent-request')
  }

  const submitViaClientFirestore = async (payload: Record<string, unknown>) => {
    const fallbackSerial = Date.now()
    await addDoc(collection(getDb(), 'parent_requests'), {
      ...payload,
      edunityId: `ED-PR-TMP-${fallbackSerial}`,
      edunityIdSerial: fallbackSerial,
      createdAt: serverTimestamp(),
    })
  }

  const checkDuplicateViaClientFirestore = async (parentEmailNormalized: string, parentPhoneNormalized: string) => {
    const db = getDb()
    const checks = await Promise.all([
      getDocs(query(collection(db, 'parent_requests'), where('parentEmail', '==', parentEmailNormalized), limit(1))),
      getDocs(
        query(collection(db, 'parent_requests'), where('parentEmailNormalized', '==', parentEmailNormalized), limit(1))
      ),
      getDocs(query(collection(db, 'parent_requests'), where('parentPhone', '==', parentPhoneNormalized), limit(1))),
      getDocs(
        query(collection(db, 'parent_requests'), where('parentPhoneNormalized', '==', parentPhoneNormalized), limit(1))
      ),
    ])

    return {
      duplicateEmail: !checks[0].empty || !checks[1].empty,
      duplicatePhone: !checks[2].empty || !checks[3].empty,
    }
  }

  const saveParentRequestLocally = (payload: Record<string, unknown>) => {
    const existingRaw = window.localStorage.getItem(PARENT_REQUESTS_STORAGE_KEY)
    const existing = existingRaw ? JSON.parse(existingRaw) : []
    window.localStorage.setItem(PARENT_REQUESTS_STORAGE_KEY, JSON.stringify([{ ...payload, createdAt: new Date().toISOString() }, ...existing]))
  }

  const validateStep1 = () => {
    const e: Record<string, string> = {}
    if (!formData.parentFullName.trim()) e.parentFullName = 'Parent name is required'
    if (!formData.parentPhone.trim()) e.parentPhone = 'Phone is required'
    if (!formData.parentEmail.includes('@')) e.parentEmail = 'Valid email is required'
    if (!formData.relationshipToLearner.trim()) e.relationshipToLearner = 'Relationship is required'
    if (!formData.consent) e.consent = 'Consent is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep2 = () => {
    const e: Record<string, string> = {}
    if (!formData.learnerName.trim()) e.learnerName = 'Learner name is required'
    if (!formData.numberOfLearners || Number(formData.numberOfLearners) < 1) e.numberOfLearners = 'Number of learners is required'
    if (!formData.learnerClass) e.learnerClass = 'Class level is required'
    const additionalCount = Math.max(0, Number(formData.numberOfLearners || 1) - 1)
    for (let i = 0; i < additionalCount; i += 1) {
      const row = formData.additionalLearners[i]
      if (!row?.name?.trim()) e[`additionalLearnerName_${i}`] = `Learner ${i + 2} name is required`
      if (!row?.classLevel) e[`additionalLearnerClass_${i}`] = `Learner ${i + 2} class is required`
    }
    if (!formData.state) e.state = 'State is required'
    if (!formData.lga) e.lga = 'LGA is required'
    if (!formData.area) e.area = 'Area is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep3 = () => {
    const e: Record<string, string> = {}
    if (formData.requestedSubjects.length === 0) e.requestedSubjects = 'Select at least one subject'
    if (!formData.lessonType) e.lessonType = 'Lesson type is required'
    if (!formData.preferredSchedule.trim()) e.preferredSchedule = 'Preferred schedule is required'
    if (!formData.urgency) e.urgency = 'Urgency is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const toggleSubject = (subject: string) => {
    setFormData((prev) => ({
      ...prev,
      requestedSubjects: prev.requestedSubjects.includes(subject)
        ? prev.requestedSubjects.filter((s) => s !== subject)
        : [...prev.requestedSubjects, subject],
    }))
  }

  const toggleExam = (exam: string) => {
    setFormData((prev) => ({
      ...prev,
      examFocus: prev.examFocus.includes(exam) ? prev.examFocus.filter((e) => e !== exam) : [...prev.examFocus, exam],
    }))
  }

  const handleNext = async () => {
    if (step === 1) {
      if (!validateStep1()) return
    }
    if (step === 2 && !validateStep2()) return
    if (step < 3) setStep(step + 1)
  }

  const handleSubmit = async () => {
    if (!validateStep3()) return
    try {
      const parentEmailNormalized = normalizeEmail(formData.parentEmail)
      const parentPhoneNormalized = normalizePhone(formData.parentPhone)
      const payload = {
        parentFullName: formData.parentFullName.trim(),
        parentPhone: parentPhoneNormalized,
        parentPhoneNormalized,
        parentEmail: parentEmailNormalized,
        parentEmailNormalized,
        relationshipToLearner: formData.relationshipToLearner.trim(),
        learnerName: formData.learnerName.trim(),
        numberOfLearners: Number(formData.numberOfLearners),
        learnerClass: formData.learnerClass,
        additionalLearners: formData.additionalLearners
          .slice(0, Math.max(0, Number(formData.numberOfLearners || 1) - 1))
          .map((row) => ({ name: row.name.trim(), classLevel: row.classLevel })),
        learners: [
          { name: formData.learnerName.trim(), classLevel: formData.learnerClass, index: 1 },
          ...formData.additionalLearners
            .slice(0, Math.max(0, Number(formData.numberOfLearners || 1) - 1))
            .map((row, idx) => ({ name: row.name.trim(), classLevel: row.classLevel, index: idx + 2 })),
        ],
        state: formData.state,
        lga: formData.lga,
        area: formData.area,
        requestedSubjects: formData.requestedSubjects,
        examFocus: formData.examFocus,
        lessonType: formData.lessonType,
        preferredSchedule: formData.preferredSchedule.trim(),
        urgency: formData.urgency,
        additionalNotes: formData.additionalNotes.trim(),
        consent: formData.consent,
        status: 'new',
      }

      saveParentRequestLocally(payload)
      if (isParentRequestHost()) {
        const duplicate = await checkDuplicateViaClientFirestore(parentEmailNormalized, parentPhoneNormalized)
        if (duplicate.duplicateEmail || duplicate.duplicatePhone) {
          throw new Error(duplicate.duplicateEmail ? 'This email already has a request.' : 'This phone already has a request.')
        }

        await submitViaClientFirestore(payload)
        setSubmitted(true)
        setErrors({})
        return
      }

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), PARENT_REQUEST_API_TIMEOUT_MS)
        let response: Response
        try {
          response = await fetch('/api/parent-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timeout)
        }

        const result = (await response.json()) as {
          ok?: boolean
          error?: string
          duplicateEmail?: boolean
          duplicatePhone?: boolean
        }
        if (!response.ok || !result.ok) {
          const duplicateMessage = result.duplicateEmail
            ? 'This email already has a request.'
            : result.duplicatePhone
              ? 'This phone already has a request.'
              : undefined
          if (response.status === 409) {
            throw new Error(duplicateMessage || result.error || 'Unable to submit parent request.')
          }

          await submitViaClientFirestore(payload)
        }
      } catch (apiError) {
        if (apiError instanceof Error && apiError.message.includes('already has a request')) {
          throw apiError
        }
        await submitViaClientFirestore(payload)
      }

      setSubmitted(true)
      setErrors({})
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Unable to submit parent request.' })
    }
  }

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1)
    setErrors({})
  }

  const allStates = getStates()
  const availableLgas = formData.state ? getLgasByState(formData.state) : []
  const availableAreas = formData.state && formData.lga ? getAreasByStateLga(formData.state, formData.lga) : []
  const selectedClasses = [
    formData.learnerClass,
    ...formData.additionalLearners.map((row) => row.classLevel),
  ].filter(Boolean)
  const availableSubjects = Array.from(new Set(selectedClasses.flatMap((level) => SUBJECTS_BY_CLASS[level] ?? [])))

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#C4C3D0' }}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10 text-center" style={{ borderTop: '6px solid #4A0000' }}>
          <div className="mx-auto mb-6 rounded-full p-5" style={{ backgroundColor: '#F5E6E0', width: 80, height: 80 }}>
            <Check className="w-10 h-10" style={{ color: '#4A0000' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#4A0000' }}>Request Received</h1>
          <p className="mt-3 text-sm text-gray-700">Thank you. Edunity will review your request and contact you shortly.</p>
        </div>
      </div>
    )
  }

  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div>
              <img src="/edunity-logo.jpg" alt="Edunity" className="w-20 h-20 mb-8 object-contain" />
              <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-3" style={{ color: '#4A0000' }}>
                Edunity<br/>Onboard
              </h1>
              <p className="text-2xl font-light" style={{ color: '#8A4B4B' }}>
                Parent Request Form
              </p>
            </div>

            <p className="text-lg text-gray-700 leading-relaxed max-w-md">
              Tell us your child’s learning needs and we’ll match you with suitable tutors.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Star className="w-4 h-4 mt-1" style={{ color: '#4A0000' }} />
                <span className="text-gray-700">Structured tutor matching process</span>
              </div>
              <div className="flex items-start gap-3">
                <Star className="w-4 h-4 mt-1" style={{ color: '#4A0000' }} />
                <span className="text-gray-700">Coverage across major subjects and exams</span>
              </div>
              <div className="flex items-start gap-3">
                <Star className="w-4 h-4 mt-1" style={{ color: '#4A0000' }} />
                <span className="text-gray-700">Online and in-person options</span>
              </div>
            </div>

            <Button onClick={() => setStep(1)} className="h-14 px-8 text-white font-semibold rounded-lg text-lg" style={{ backgroundColor: '#4A0000' }}>
              Get Started
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          <div className="hidden md:flex items-center justify-center">
            <img src="/edtech-illustration.jpg" alt="Parent Request" className="w-full max-w-lg object-contain rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#C4C3D0' }}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8" style={{ borderTop: '6px solid #4A0000' }}>
        <div className="mb-8 pb-6 border-b-2" style={{ borderColor: '#C4C3D0' }}>
          <div className="flex justify-between gap-4 mb-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1">
                <div className="h-2 rounded-full" style={{ backgroundColor: s <= step ? '#4A0000' : '#C4C3D0' }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span style={{ color: step >= 1 ? '#4A0000' : '#C4C3D0' }}>Contact</span>
            <span style={{ color: step >= 2 ? '#4A0000' : '#C4C3D0' }}>Learner & Location</span>
            <span style={{ color: step >= 3 ? '#4A0000' : '#C4C3D0' }}>Request Details</span>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold" style={{ color: '#4A0000' }}>Parent Contact</h2>
            <div>
              <Label className="font-semibold mb-2 block">Full Name *</Label>
              <Input value={formData.parentFullName} onChange={(e) => setFormData({ ...formData, parentFullName: e.target.value })} className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }} />
              {errors.parentFullName && <p className="text-red-500 text-sm mt-1">{errors.parentFullName}</p>}
            </div>
            <div>
              <Label className="font-semibold mb-2 block">Phone *</Label>
              <Input value={formData.parentPhone} onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })} className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }} />
              {errors.parentPhone && <p className="text-red-500 text-sm mt-1">{errors.parentPhone}</p>}
            </div>
            <div>
              <Label className="font-semibold mb-2 block">Email *</Label>
              <Input type="email" value={formData.parentEmail} onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })} className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }} />
              {errors.parentEmail && <p className="text-red-500 text-sm mt-1">{errors.parentEmail}</p>}
            </div>
            <div>
              <Label className="font-semibold mb-2 block">Relationship to learner *</Label>
              <Input value={formData.relationshipToLearner} onChange={(e) => setFormData({ ...formData, relationshipToLearner: e.target.value })} placeholder="Parent / Guardian" className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }} />
              {errors.relationshipToLearner && <p className="text-red-500 text-sm mt-1">{errors.relationshipToLearner}</p>}
            </div>
            <div className="flex items-start gap-3">
              <Checkbox checked={formData.consent} onCheckedChange={(checked) => setFormData({ ...formData, consent: checked === true })} />
              <p className="text-sm text-gray-700">I consent to Edunity processing this request and contacting me.</p>
            </div>
            {errors.consent && <p className="text-red-500 text-sm">{errors.consent}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold" style={{ color: '#4A0000' }}>Learner & Location</h2>
            <div>
              <Label className="font-semibold mb-2 block">Learner Name *</Label>
              <Input value={formData.learnerName} onChange={(e) => setFormData({ ...formData, learnerName: e.target.value })} className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }} />
              {errors.learnerName && <p className="text-red-500 text-sm mt-1">{errors.learnerName}</p>}
            </div>
            <div>
              <Label className="font-semibold mb-2 block">Number of Learners *</Label>
              <Input
                type="number"
                min={1}
                value={formData.numberOfLearners}
                onChange={(e) => {
                  const raw = e.target.value
                  const count = Number(raw || 0)
                  const desired = Number.isFinite(count) && count > 1 ? count - 1 : 0
                  const resized = Array.from({ length: desired }, (_, idx) => formData.additionalLearners[idx] ?? { name: '', classLevel: '' })
                  setFormData({ ...formData, numberOfLearners: raw, additionalLearners: resized, requestedSubjects: [] })
                }}
                placeholder="e.g. 1"
                className="h-11 rounded-lg"
                style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}
              />
              {errors.numberOfLearners && <p className="text-red-500 text-sm mt-1">{errors.numberOfLearners}</p>}
            </div>
            <div>
              <Label className="font-semibold mb-2 block">Class Level *</Label>
              <Select
                value={formData.learnerClass}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    learnerClass: value,
                    requestedSubjects: [],
                  })
                }
              >
                <SelectTrigger className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select class level" />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_RANGE.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.learnerClass && <p className="text-red-500 text-sm mt-1">{errors.learnerClass}</p>}
            </div>
            {Number(formData.numberOfLearners || 0) > 1 && (
              <div className="space-y-4 rounded-lg border p-4" style={{ borderColor: '#C4C3D0' }}>
                <h3 className="font-semibold" style={{ color: '#4A0000' }}>Additional Learners</h3>
                {formData.additionalLearners.map((row, idx) => (
                  <div key={`learner-${idx}`} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label className="font-semibold mb-2 block">{`Learner ${idx + 2} Name *`}</Label>
                      <Input
                        value={row.name}
                        onChange={(e) => {
                          const next = [...formData.additionalLearners]
                          next[idx] = { ...next[idx], name: e.target.value }
                          setFormData({ ...formData, additionalLearners: next })
                        }}
                        className="h-11 rounded-lg"
                        style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}
                      />
                      {errors[`additionalLearnerName_${idx}`] && <p className="text-red-500 text-sm mt-1">{errors[`additionalLearnerName_${idx}`]}</p>}
                    </div>
                    <div>
                      <Label className="font-semibold mb-2 block">{`Learner ${idx + 2} Class *`}</Label>
                      <Select
                        value={row.classLevel}
                        onValueChange={(value) => {
                          const next = [...formData.additionalLearners]
                          next[idx] = { ...next[idx], classLevel: value }
                          setFormData({ ...formData, additionalLearners: next, requestedSubjects: [] })
                        }}
                      >
                        <SelectTrigger className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                          <SelectValue placeholder="Select class level" />
                        </SelectTrigger>
                        <SelectContent>
                          {CLASS_RANGE.map((c) => (<SelectItem key={`${c}-${idx}`} value={c}>{c}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      {errors[`additionalLearnerClass_${idx}`] && <p className="text-red-500 text-sm mt-1">{errors[`additionalLearnerClass_${idx}`]}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div>
              <Label className="font-semibold mb-2 block">State *</Label>
              <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value, lga: '', area: '' })}>
                <SelectTrigger className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {allStates.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
            </div>
            <div>
              <Label className="font-semibold mb-2 block">LGA *</Label>
              <Select value={formData.lga} onValueChange={(value) => setFormData({ ...formData, lga: value, area: '' })} disabled={!formData.state}>
                <SelectTrigger className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select LGA" />
                </SelectTrigger>
                <SelectContent>
                  {availableLgas.map((lga) => (<SelectItem key={lga} value={lga}>{lga}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.lga && <p className="text-red-500 text-sm mt-1">{errors.lga}</p>}
            </div>
            <div>
              <Label className="font-semibold mb-2 block">Area *</Label>
              <Select value={formData.area} onValueChange={(value) => setFormData({ ...formData, area: value })} disabled={!formData.lga}>
                <SelectTrigger className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {availableAreas.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.area && <p className="text-red-500 text-sm mt-1">{errors.area}</p>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 max-h-96 overflow-y-auto pr-2">
            <h2 className="text-2xl font-bold" style={{ color: '#4A0000' }}>Request Details</h2>
            <div>
              <Label className="font-semibold mb-2 block">Requested Subjects for Selected Learner Class(es) *</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {availableSubjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border text-left ${formData.requestedSubjects.includes(subject) ? 'text-white border-red-800' : 'border-gray-300 text-gray-700'}`}
                    style={{ backgroundColor: formData.requestedSubjects.includes(subject) ? '#4A0000' : 'transparent' }}
                  >
                    {subject}
                  </button>
                ))}
              </div>
              {availableSubjects.length === 0 && <p className="text-xs mt-1 text-gray-500">Select learner class details first to see relevant subjects.</p>}
              {errors.requestedSubjects && <p className="text-red-500 text-sm mt-1">{errors.requestedSubjects}</p>}
            </div>

            <div>
              <Label className="font-semibold mb-2 block">Exam Focus</Label>
              <div className="flex flex-wrap gap-2">
                {EXAM_FOCUS.map((exam) => (
                  <button
                    key={exam}
                    type="button"
                    onClick={() => toggleExam(exam)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border ${formData.examFocus.includes(exam) ? 'text-white border-red-800' : 'border-gray-300 text-gray-700'}`}
                    style={{ backgroundColor: formData.examFocus.includes(exam) ? '#4A0000' : 'transparent' }}
                  >
                    {exam}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="font-semibold mb-2 block">Lesson Type *</Label>
              <Select value={formData.lessonType} onValueChange={(value) => setFormData({ ...formData, lessonType: value })}>
                <SelectTrigger className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select lesson type" />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_TYPES.map((t) => (<SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
              {errors.lessonType && <p className="text-red-500 text-sm mt-1">{errors.lessonType}</p>}
            </div>

            <div>
              <Label className="font-semibold mb-2 block">Preferred Schedule *</Label>
              <Input value={formData.preferredSchedule} onChange={(e) => setFormData({ ...formData, preferredSchedule: e.target.value })} placeholder="e.g. Weekdays 4pm - 7pm" className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }} />
              {errors.preferredSchedule && <p className="text-red-500 text-sm mt-1">{errors.preferredSchedule}</p>}
            </div>

            <div>
              <Label className="font-semibold mb-2 block">Urgency *</Label>
              <Select value={formData.urgency} onValueChange={(value) => setFormData({ ...formData, urgency: value })}>
                <SelectTrigger className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent (within 24-48hrs)</SelectItem>
                  <SelectItem value="normal">Normal (this week)</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
                </SelectContent>
              </Select>
              {errors.urgency && <p className="text-red-500 text-sm mt-1">{errors.urgency}</p>}
            </div>

            <div>
              <Label className="font-semibold mb-2 block">Additional Notes</Label>
              <Textarea value={formData.additionalNotes} onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })} rows={4} className="rounded-lg border border-gray-300" placeholder="Any additional context for the tutor match" />
            </div>
          </div>
        )}

        {errors.submit && <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.submit}</div>}

        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
          <Button onClick={handlePrevious} variant="outline" disabled={step === 1} className="flex-1 h-11 rounded-lg border border-gray-300 font-semibold bg-transparent">
            <ChevronLeft className="w-4 h-4 mr-2" /> Previous
          </Button>

          {step === 3 ? (
            <Button onClick={handleSubmit} className="flex-1 h-11 text-white font-semibold rounded-lg" style={{ backgroundColor: '#4A0000' }}>
              <Check className="w-4 h-4 mr-2" /> Submit Request
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={step === 1 && !formData.consent} className="flex-1 h-11 text-white font-semibold rounded-lg" style={{ backgroundColor: '#4A0000' }}>
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
