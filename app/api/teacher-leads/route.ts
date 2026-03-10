import { NextResponse } from 'next/server'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { assignLeadRoundRobin } from '@/lib/lead-routing'
import { logLeadActivity } from '@/lib/lead-audit'
import { resolveReferralOwner } from '@/lib/referrals'
import { getInitialOwnerTeam } from '@/lib/lead-workflows'
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
    const referralCode =
      typeof body.referralCode === 'string'
        ? body.referralCode.trim()
        : typeof body.ref === 'string'
          ? body.ref.trim()
          : ''

    if (!fullName || !emailNormalized || !phoneNormalized) {
      return NextResponse.json(
        { ok: false, error: 'fullName, email, and phone are required.' },
        { status: 400 }
      )
    }

    const referralOwner = await resolveReferralOwner(referralCode)
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
      getDocs(query(collection(db, 'parent_requests'), where('parentPhoneNormalized', '==', phoneNormalized), limit(1))),
      getDocs(query(collection(db, 'school_leads'), where('phoneNumberNormalized', '==', phoneNormalized), limit(1))),
    ])

    const duplicateEmail = !duplicateChecks[0].empty || !duplicateChecks[1].empty
    const duplicatePhone = !duplicateChecks[2].empty || !duplicateChecks[3].empty
    const probableDuplicate = !duplicateChecks[4].empty || !duplicateChecks[5].empty
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

    const initialTeamOwner = getInitialOwnerTeam('TEACHER')
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
      leadSource:
        typeof body.leadSource === 'string' && body.leadSource.trim()
          ? body.leadSource.trim()
          : referralOwner.createdByUserId
            ? 'referral_link'
            : 'teacher_form',
      referralCode: referralOwner.referralCode,
      createdByUserId: referralOwner.createdByUserId,
      createdByUserName: referralOwner.createdByUserName,
      leadType: 'TEACHER',
      status: 'INTERESTED',
      isValid: true,
      rejectionReason: '',
      probableDuplicate,
      duplicateFlagReason: probableDuplicate ? 'Phone number overlaps with an existing lead in another pipeline.' : '',
      currentTeamOwner: initialTeamOwner,
      assignedDepartment: initialTeamOwner,
      qualifiedByUserId: '',
      routedByUserId: '',
      routedByUserName: '',
      lastStatusChangedByUserId: '',
    }

    const created = await createTeacherLeadAtomic(payload)
    const assignment = await assignLeadRoundRobin({
      leadId: created.id,
      collectionName: TEACHER_LEADS_COLLECTION,
      leadType: 'TEACHER',
      createdByUserId: referralOwner.createdByUserId,
      createdByUserName: referralOwner.createdByUserName,
      teamOwner: initialTeamOwner,
      notes: 'Auto-assigned on teacher lead creation.',
    })

    await logLeadActivity({
      collectionName: TEACHER_LEADS_COLLECTION,
      leadId: created.id,
      leadType: 'TEACHER',
      activityType: 'LEAD_CREATED',
      message: `Teacher lead created for ${fullName}.`,
      userId: referralOwner.createdByUserId || 'system',
      userName: referralOwner.createdByUserName || 'System',
      nextStatus: 'INTERESTED',
      teamOwner: initialTeamOwner,
      metadata: {
        referralCode: referralOwner.referralCode,
        assignedToUserId: assignment?.assignedUserId ?? '',
        assignedToUserName: assignment?.assignedUserName ?? '',
      },
    })

    return NextResponse.json(
      {
        ok: true,
        ...created,
        assignedToUserId: assignment?.assignedUserId ?? '',
        assignedToUserName: assignment?.assignedUserName ?? '',
      },
      { status: 201 }
    )
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
