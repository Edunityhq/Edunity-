'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronRight, ChevronLeft, Check, Star } from 'lucide-react'
import { getStates, getLgasByState, getAreasByStateLga } from '@/data/locations'
import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const SUBJECTS = [
  'Mathematics',
  'English Language',
  'Physics',
  'Chemistry',
  'Biology',
  'Further Mathematics',
  'Agricultural Science',
  'Economics',
  'Commerce',
  'Accounting',
  'Government',
  'Civic Education',
  'Literature in English',
  'CRS',
  'IRS',
  'Geography',
  'History',
  'French',
  'Yoruba',
  'Igbo',
  'Hausa',
  'Computer Studies / ICT',
]

const EXAM_FOCUS = ['WAEC', 'NECO', 'JAMB', 'IGCSE', 'SAT']
const CLASS_RANGE = [
  'Nursery / Early Years',
  'Primary (Years 1-6)',
  'Junior Secondary (JSS 1-3)',
  'Senior Secondary (SSS 1-3)',
  'IGCSE / Cambridge',
  'A-Levels',
  'Adult / Professional learners',
]
const LESSON_TYPES = ['Online', 'In-person', 'Both']

interface FormData {
  fullName: string
  phoneNumber: string
  email: string
  consent: boolean
  state: string
  lga: string
  area: string
  subjects: string[]
  minClass: string
  maxClass: string
  examFocus: string[]
  availability: string
  lessonType: string
  privateTutoring: string
  teachingExperience: string
}

export default function TeacherOnboardingForm() {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    phoneNumber: '',
    email: '',
    consent: false,
    state: '',
    lga: '',
    area: '',
    subjects: [],
    minClass: '',
    maxClass: '',
    examFocus: [],
    availability: '',
    lessonType: '',
    privateTutoring: '',
    teachingExperience: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required'
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required'
    if (!formData.email.includes('@')) newErrors.email = 'Valid email is required'
    if (!formData.consent) newErrors.consent = 'You must agree to terms'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.state) newErrors.state = 'State is required'
    if (!formData.lga) newErrors.lga = 'LGA is required'
    if (!formData.area) newErrors.area = 'Area is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {}
    if (formData.subjects.length === 0) newErrors.subjects = 'Select at least one subject'
    if (!formData.minClass || !formData.maxClass) newErrors.classRange = 'Both class values are required'
    if (formData.minClass && formData.maxClass) {
      const minIndex = CLASS_RANGE.indexOf(formData.minClass)
      const maxIndex = CLASS_RANGE.indexOf(formData.maxClass)
      if (minIndex > maxIndex) {
        newErrors.classRange = 'Starting class cannot be greater than ending class'
      }
    }
    if (!formData.availability) newErrors.availability = 'Availability status is required'
    if (!formData.lessonType) newErrors.lessonType = 'Lesson type is required'
    if (!formData.privateTutoring) newErrors.privateTutoring = 'Private tutoring preference is required'
    if (!formData.teachingExperience.trim() || formData.teachingExperience.length < 30) {
      newErrors.teachingExperience = 'Teaching experience must be at least 30 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    if (step < 3) setStep(step + 1)
  }

  const handleSubmit = async () => {
    if (!validateStep3()) return
    if (!formData.consent) {
      setErrors((prev) => ({ ...prev, consent: 'You must agree to terms before submitting.' }))
      setStep(1)
      return
    }

    try {
      const normalizedEmail = formData.email.trim().toLowerCase()
      const normalizedPhone = formData.phoneNumber.replace(/\D/g, '')

      const duplicateChecks = await Promise.all([
        getDocs(query(collection(db, 'teacher_interests'), where('email', '==', normalizedEmail), limit(1))),
        getDocs(
          query(collection(db, 'teacher_interests'), where('emailNormalized', '==', normalizedEmail), limit(1))
        ),
        getDocs(query(collection(db, 'teacher_interests'), where('phone', '==', normalizedPhone), limit(1))),
        getDocs(
          query(collection(db, 'teacher_interests'), where('phoneNormalized', '==', normalizedPhone), limit(1))
        ),
      ])

      const duplicateEmail = !duplicateChecks[0].empty || !duplicateChecks[1].empty
      const duplicatePhone = !duplicateChecks[2].empty || !duplicateChecks[3].empty

      if (duplicateEmail || duplicatePhone) {
        setErrors((prev) => ({
          ...prev,
          submit: duplicateEmail
            ? 'This email is already registered.'
            : 'This phone number is already registered.',
        }))
        return
      }

      const payload = {
        fullName: formData.fullName,
        email: normalizedEmail,
        emailNormalized: normalizedEmail,
        phone: normalizedPhone,
        phoneNormalized: normalizedPhone,
        state: formData.state,
        lga: formData.lga,
        area: formData.area,
        subjects: formData.subjects,
        minClass: formData.minClass,
        maxClass: formData.maxClass,
        examFocus: formData.examFocus,
        availability: formData.availability,
        lessonType: formData.lessonType,
        privateTutoring: formData.privateTutoring,
        teachingExperience: formData.teachingExperience,
        consent: formData.consent,
      }

      console.log('Submitting payload:', payload)

      try {
        const docRef = await addDoc(collection(db, 'teacher_interests'), {
          ...payload,
          createdAt: serverTimestamp(),
        })
        console.log('Saved to Firestore:', docRef.id)
        setSubmitted(true)
        setErrors({})
      } catch (e) {
        console.error('Firestore error:', e)
        throw e
      }
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? `Error submitting form: ${err.message}` : 'Error submitting form.',
      })
    }
  }

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1)
    setErrors({})
  }

  const handleSubjectToggle = (subject: string) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }))
  }

  const handleExamToggle = (exam: string) => {
    setFormData((prev) => ({
      ...prev,
      examFocus: prev.examFocus.includes(exam)
        ? prev.examFocus.filter((e) => e !== exam)
        : [...prev.examFocus, exam],
    }))
  }

  const availableLgas = formData.state ? getLgasByState(formData.state) : []
  const availableAreas = formData.state && formData.lga ? getAreasByStateLga(formData.state, formData.lga) : []
  const allStates = getStates()

  // Success Page
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#C4C3D0' }}>
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-12 text-center" style={{ borderTop: '6px solid #4A0000' }}>
            <div className="flex justify-center mb-8">
              <div className="rounded-full p-6" style={{ backgroundColor: '#F5E6E0' }}>
                <Check className="w-12 h-12" style={{ color: '#4A0000' }} />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#4A0000' }}>
              Thank you, {formData.fullName}
            </h1>
            <p className="text-gray-600 text-lg mb-8 leading-relaxed">
              for filling out your registration information. Your profile has been submitted successfully.
            </p>

            <div className="space-y-3 mb-8 text-left">
              <p className="text-sm font-semibold" style={{ color: '#4A0000' }}>What happens next:</p>
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4A0000' }} />
                <span className="text-sm text-gray-700">Review will be completed within 24-48 hours</span>
              </div>
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#4A0000' }} />
                <span className="text-sm text-gray-700">You'll be contacted by Edunity with next steps</span>
              </div>
            </div>

            <Button
              onClick={() => {
                setSubmitted(false)
                setStep(0)
                setFormData({
                  fullName: '',
                  phoneNumber: '',
                  email: '',
                  consent: false,
                  state: '',
                  lga: '',
                  area: '',
                  subjects: [],
                  minClass: '',
                  maxClass: '',
                  examFocus: [],
                  availability: '',
                  lessonType: '',
                  privateTutoring: '',
                  teachingExperience: '',
                })
                setErrors({})
              }}
              className="w-full h-12 text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
              style={{ backgroundColor: '#4A0000' }}
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Welcome Page
  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div>
                <img src="/edunity-logo.jpg" alt="Edunity" className="w-20 h-20 mb-8 object-contain" />
                <h1 className="text-6xl md:text-7xl font-bold leading-tight mb-3" style={{ color: '#4A0000' }}>
                  Edunity<br/>Onboard
                </h1>
                <p className="text-2xl font-light" style={{ color: '#C4C3D0' }}>
                  The Backbone of Better Learning
                </p>
              </div>

              <p className="text-lg text-gray-700 leading-relaxed max-w-md">
                Edunity connects skilled tutors to reputable schools and serious learners, from short-term roles to long-term teaching placements.
              </p>

              <div className="space-y-4">
                <p className="text-sm font-semibold" style={{ color: '#4A0000' }}>By completing this form, you position yourself for:</p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: '#4A0000' }}></span>
                    <span className="text-gray-700">Structured tutoring opportunities</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: '#4A0000' }}></span>
                    <span className="text-gray-700">Visibility to partner schools</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2" style={{ backgroundColor: '#4A0000' }}></span>
                    <span className="text-gray-700">Future teaching and placement roles</span>
                  </li>
                </ul>
              </div>

              <Button
                onClick={() => setStep(1)}
                className="h-14 px-8 text-white font-semibold rounded-lg text-lg hover:shadow-xl transition-all"
                style={{ backgroundColor: '#4A0000' }}
              >
                Get Started
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>

            {/* Right - Edtech Illustration */}
            <div className="hidden md:flex items-center justify-center">
              <div className="relative">
                <img src="/edtech-illustration.jpg" alt="Education Technology" className="w-full max-w-lg object-contain rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Form Container
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#C4C3D0' }}>
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8" style={{ borderTop: '6px solid #4A0000' }}>
        {/* Step Indicator */}
        <div className="mb-8 pb-6 border-b-2" style={{ borderColor: '#C4C3D0' }}>
          <div className="flex justify-between gap-4 mb-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    backgroundColor: s <= step ? '#4A0000' : '#C4C3D0',
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs font-semibold">
            <span style={{ color: step >= 1 ? '#4A0000' : '#C4C3D0' }}>Personal Details</span>
            <span style={{ color: step >= 2 ? '#4A0000' : '#C4C3D0' }}>Location</span>
            <span style={{ color: step >= 3 ? '#4A0000' : '#C4C3D0' }}>Preferences</span>
          </div>
        </div>

        {/* Step 1: Personal Details */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold mb-6" style={{ color: '#4A0000' }}>
                Personal Details
              </h2>
            </div>

            <div>
              <Label htmlFor="fullName" className="font-semibold mb-2 block">
                Full Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="h-11 rounded-lg"
                style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}
              />
              {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <Label htmlFor="phoneNumber" className="font-semibold mb-2 block">
                Phone Number <span className="text-red-600">*</span>
              </Label>
              <Input
                id="phoneNumber"
                placeholder="+234 (0) 80 0000 0000"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="h-11 rounded-lg"
                style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}
              />
              {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>}
            </div>

            <div>
              <Label htmlFor="email" className="font-semibold mb-2 block">
                Email Address <span className="text-red-600">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-11 rounded-lg"
                style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="consent"
                checked={formData.consent}
                onCheckedChange={(checked) => setFormData({ ...formData, consent: checked as boolean })}
              />
              <label htmlFor="consent" className="text-sm text-gray-700 cursor-pointer">
                I consent to Edunity contacting me and processing my information for onboarding and matching purposes.
              </label>
            </div>
            {errors.consent && <p className="text-red-500 text-sm">{errors.consent}</p>}
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold mb-6" style={{ color: '#4A0000' }}>
                Where Are You Located?
              </h2>
            </div>

            <div>
              <Label htmlFor="state" className="font-semibold mb-2 block">
                State <span className="text-red-600">*</span>
              </Label>
              <Select value={formData.state} onValueChange={(value) => setFormData({ ...formData, state: value, lga: '', area: '' })}>
                <SelectTrigger id="state" className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {allStates.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
            </div>

            <div>
              <Label htmlFor="lga" className="font-semibold mb-2 block">
                LGA <span className="text-red-600">*</span>
              </Label>
              <Select value={formData.lga} onValueChange={(value) => setFormData({ ...formData, lga: value, area: '' })} disabled={!formData.state}>
                <SelectTrigger id="lga" className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select LGA" />
                </SelectTrigger>
                <SelectContent>
                  {availableLgas.map((lga) => (
                    <SelectItem key={lga} value={lga}>
                      {lga}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.lga && <p className="text-red-500 text-sm mt-1">{errors.lga}</p>}
            </div>

            <div>
              <Label htmlFor="area" className="font-semibold mb-2 block">
                Area <span className="text-red-600">*</span>
              </Label>
              <Select value={formData.area} onValueChange={(value) => setFormData({ ...formData, area: value })} disabled={!formData.lga}>
                <SelectTrigger id="area" className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {availableAreas.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.area && <p className="text-red-500 text-sm mt-1">{errors.area}</p>}
            </div>
          </div>
        )}

        {/* Step 3: Teaching Preferences */}
        {step === 3 && (
          <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
            <div>
              <h2 className="text-2xl font-bold mb-6" style={{ color: '#4A0000' }}>
                Teaching Preferences
              </h2>
            </div>

            {/* Subjects */}
            <div>
              <Label className="font-semibold mb-3 block">
                Subjects You Teach <span className="text-red-600">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {SUBJECTS.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => handleSubjectToggle(subject)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all text-left ${
                      formData.subjects.includes(subject)
                        ? 'border-red-600 text-white'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                    style={{
                      backgroundColor: formData.subjects.includes(subject) ? '#4A0000' : 'transparent',
                    }}
                  >
                    {subject}
                  </button>
                ))}
              </div>
              {errors.subjects && <p className="text-red-500 text-sm mt-2">{errors.subjects}</p>}
            </div>

            {/* Class Range */}
            <div>
              <Label className="font-semibold mb-3 block">
                Teaching Levels <span className="text-red-600">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minClass" className="text-sm text-gray-600 mb-1 block">
                    From
                  </Label>
                  <Select value={formData.minClass} onValueChange={(value) => setFormData({ ...formData, minClass: value })}>
                    <SelectTrigger id="minClass" className="h-10 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASS_RANGE.map((cls) => (
                        <SelectItem key={cls} value={cls}>
                          {cls}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="maxClass" className="text-sm text-gray-600 mb-1 block">
                    To
                  </Label>
                  <Select value={formData.maxClass} onValueChange={(value) => setFormData({ ...formData, maxClass: value })}>
                    <SelectTrigger id="maxClass" className="h-10 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASS_RANGE.map((cls) => (
                        <SelectItem key={cls} value={cls}>
                          {cls}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {errors.classRange && <p className="text-red-500 text-sm mt-2">{errors.classRange}</p>}
            </div>

            {/* Exam Focus */}
            <div>
              <Label className="font-semibold mb-3 block">
                Exam Focus
              </Label>
              <div className="flex flex-wrap gap-2">
                {EXAM_FOCUS.map((exam) => (
                  <button
                    key={exam}
                    onClick={() => handleExamToggle(exam)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                      formData.examFocus.includes(exam)
                        ? 'border-red-600 text-white'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                    style={{
                      backgroundColor: formData.examFocus.includes(exam) ? '#4A0000' : 'transparent',
                    }}
                  >
                    {exam}
                  </button>
                ))}
              </div>
            </div>

            {/* Availability */}
            <div>
              <Label htmlFor="availability" className="font-semibold mb-2 block">
                Availability <span className="text-red-600">*</span>
              </Label>
              <Select value={formData.availability} onValueChange={(value) => setFormData({ ...formData, availability: value })}>
                <SelectTrigger id="availability" className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
                </SelectContent>
              </Select>
              {errors.availability && <p className="text-red-500 text-sm mt-1">{errors.availability}</p>}
            </div>

            {/* Lesson Type */}
            <div>
              <Label htmlFor="lessonType" className="font-semibold mb-2 block">
                Preferred Lesson Type <span className="text-red-600">*</span>
              </Label>
              <Select value={formData.lessonType} onValueChange={(value) => setFormData({ ...formData, lessonType: value })}>
                <SelectTrigger id="lessonType" className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select lesson type" />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_TYPES.map((type) => (
                    <SelectItem key={type} value={type.toLowerCase()}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.lessonType && <p className="text-red-500 text-sm mt-1">{errors.lessonType}</p>}
            </div>

            {/* Private Tutoring */}
            <div>
              <Label htmlFor="privateTutoring" className="font-semibold mb-2 block">
                Open to Private Tutoring <span className="text-red-600">*</span>
              </Label>
              <Select value={formData.privateTutoring} onValueChange={(value) => setFormData({ ...formData, privateTutoring: value })}>
                <SelectTrigger id="privateTutoring" className="h-11 rounded-lg" style={{ borderColor: '#C4C3D0', borderWidth: '1px' }}>
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="maybe">Maybe</SelectItem>
                </SelectContent>
              </Select>
              {errors.privateTutoring && <p className="text-red-500 text-sm mt-1">{errors.privateTutoring}</p>}
            </div>

            {/* Teaching Experience */}
            <div>
              <Label htmlFor="experience" className="font-semibold mb-2 block">
                Your Teaching Experience <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="experience"
                placeholder="Tell us about your teaching experience (minimum 30 characters)..."
                value={formData.teachingExperience}
                onChange={(e) => setFormData({ ...formData, teachingExperience: e.target.value })}
                className="min-h-24 rounded-lg border border-gray-300 p-3"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.teachingExperience.length}/30 characters minimum</p>
              {errors.teachingExperience && <p className="text-red-500 text-sm mt-1">{errors.teachingExperience}</p>}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        {errors.submit && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {errors.submit}
          </div>
        )}
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
          <Button
            onClick={handlePrevious}
            variant="outline"
            disabled={step === 1}
            className="flex-1 h-11 rounded-lg border border-gray-300 font-semibold bg-transparent"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {step === 3 ? (
            <Button
              onClick={handleSubmit}
              className="flex-1 h-11 text-white font-semibold rounded-lg"
              style={{ backgroundColor: '#4A0000' }}
            >
              <Check className="w-4 h-4 mr-2" />
              Submit
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="flex-1 h-11 text-white font-semibold rounded-lg"
              style={{ backgroundColor: '#4A0000' }}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

