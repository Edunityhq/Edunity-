import { NextResponse } from 'next/server'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import {
  createTeacherLeadAtomic,
  TEACHER_LEAD_DUPLICATE_EMAIL_ERROR,
  TEACHER_LEAD_DUPLICATE_PHONE_ERROR,
  TEACHER_LEADS_COLLECTION,
} from '@/lib/teacher-leads'

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizePhone(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const emailNormalized = normalizeEmail(body.email)
    const phoneNormalized = normalizePhone(body.phone)

    if (!fullName || !emailNormalized || !phoneNormalized) {
      return NextResponse.json(
        { ok: false, error: 'fullName, email, and phone are required.' },
        { status: 400 }
      )
    }

    const db = getDb()
    const duplicateChecks = await Promise.all([
      getDocs(query(collection(db, TEACHER_LEADS_COLLECTION), where('email', '==', emailNormalized), limit(1))),
      getDocs(
        query(collection(db, TEACHER_LEADS_COLLECTION), where('emailNormalized', '==', emailNormalized), limit(1))
      ),
      getDocs(query(collection(db, TEACHER_LEADS_COLLECTION), where('phone', '==', phoneNormalized), limit(1))),
      getDocs(
        query(collection(db, TEACHER_LEADS_COLLECTION), where('phoneNormalized', '==', phoneNormalized), limit(1))
      ),
    ])

    const duplicateEmail = !duplicateChecks[0].empty || !duplicateChecks[1].empty
    const duplicatePhone = !duplicateChecks[2].empty || !duplicateChecks[3].empty
    if (duplicateEmail || duplicatePhone) {
      return NextResponse.json(
        {
          ok: false,
          duplicateEmail,
          duplicatePhone,
          error: duplicateEmail ? 'This email is already registered.' : 'This phone number is already registered.',
        },
        { status: 409 }
      )
    }

    const payload = {
      fullName,
      email: emailNormalized,
      emailNormalized,
      phone: phoneNormalized,
      phoneNormalized,
      state: typeof body.state === 'string' ? body.state : '',
      lga: typeof body.lga === 'string' ? body.lga : '',
      area: typeof body.area === 'string' ? body.area : '',
      subjects: Array.isArray(body.subjects) ? body.subjects : [],
      minClass: typeof body.minClass === 'string' ? body.minClass : '',
      maxClass: typeof body.maxClass === 'string' ? body.maxClass : '',
      examFocus: Array.isArray(body.examFocus) ? body.examFocus : [],
      availability: typeof body.availability === 'string' ? body.availability : '',
      lessonType: typeof body.lessonType === 'string' ? body.lessonType : '',
      privateTutoring: typeof body.privateTutoring === 'string' ? body.privateTutoring : '',
      teachingExperience: typeof body.teachingExperience === 'string' ? body.teachingExperience : '',
      consent: Boolean(body.consent),
      source: 'teacher_form',
    }

    const created = await createTeacherLeadAtomic(payload)
    return NextResponse.json({ ok: true, ...created }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === TEACHER_LEAD_DUPLICATE_EMAIL_ERROR) {
      return NextResponse.json(
        {
          ok: false,
          duplicateEmail: true,
          duplicatePhone: false,
          error: 'This email is already registered.',
        },
        { status: 409 }
      )
    }

    if (error instanceof Error && error.message === TEACHER_LEAD_DUPLICATE_PHONE_ERROR) {
      return NextResponse.json(
        {
          ok: false,
          duplicateEmail: false,
          duplicatePhone: true,
          error: 'This phone number is already registered.',
        },
        { status: 409 }
      )
    }

    if (error instanceof Error && error.message === 'MISSING_CONTACT_KEY') {
      return NextResponse.json(
        {
          ok: false,
          error: 'email and phone are required.',
        },
        { status: 400 }
      )
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
