import { NextResponse } from 'next/server'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { assignLeadRoundRobin } from '@/lib/lead-routing'
import { logLeadActivity } from '@/lib/lead-audit'
import { resolveReferralOwner } from '@/lib/referrals'
import { getInitialOwnerTeam } from '@/lib/lead-workflows'
import { createParentRequestAtomic, PARENT_REQUESTS_COLLECTION } from '@/lib/parent-requests'

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizePhone(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : ''
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const parentFullName = typeof body.parentFullName === 'string' ? body.parentFullName.trim() : ''
    const parentEmailNormalized = normalizeEmail(body.parentEmail)
    const parentPhoneNormalized = normalizePhone(body.parentPhone)
    const relationshipToLearner =
      typeof body.relationshipToLearner === 'string' ? body.relationshipToLearner.trim() : ''
    const learnerName = typeof body.learnerName === 'string' ? body.learnerName.trim() : ''
    const requestedSubjects = Array.isArray(body.requestedSubjects)
      ? body.requestedSubjects.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : []
    const referralCode =
      typeof body.referralCode === 'string'
        ? body.referralCode.trim()
        : typeof body.ref === 'string'
          ? body.ref.trim()
          : ''

    if (!parentFullName || !parentEmailNormalized || !parentPhoneNormalized) {
      return NextResponse.json(
        { ok: false, error: 'parentFullName, parentEmail, and parentPhone are required.' },
        { status: 400 }
      )
    }

    if (!relationshipToLearner || !learnerName || requestedSubjects.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'relationshipToLearner, learnerName, and requestedSubjects are required.' },
        { status: 400 }
      )
    }

    const referralOwner = await resolveReferralOwner(referralCode)
    const db = getDb()
    const duplicateChecks = await Promise.all([
      getDocs(
        query(collection(db, PARENT_REQUESTS_COLLECTION), where('parentEmail', '==', parentEmailNormalized), limit(1))
      ),
      getDocs(
        query(
          collection(db, PARENT_REQUESTS_COLLECTION),
          where('parentEmailNormalized', '==', parentEmailNormalized),
          limit(1)
        )
      ),
      getDocs(
        query(collection(db, PARENT_REQUESTS_COLLECTION), where('parentPhone', '==', parentPhoneNormalized), limit(1))
      ),
      getDocs(
        query(
          collection(db, PARENT_REQUESTS_COLLECTION),
          where('parentPhoneNormalized', '==', parentPhoneNormalized),
          limit(1)
        )
      ),
      getDocs(query(collection(db, 'teacher_interests'), where('phoneNormalized', '==', parentPhoneNormalized), limit(1))),
      getDocs(query(collection(db, 'school_leads'), where('phoneNumberNormalized', '==', parentPhoneNormalized), limit(1))),
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
          error: duplicateEmail ? 'This email already has a request.' : 'This phone already has a request.',
        },
        { status: 409 }
      )
    }

    const numberOfLearners =
      typeof body.numberOfLearners === 'number' ? body.numberOfLearners : Number(body.numberOfLearners ?? 0)
    const additionalLearners = Array.isArray(body.additionalLearners) ? body.additionalLearners : []
    const learners = Array.isArray(body.learners) ? body.learners : []
    const examFocus = Array.isArray(body.examFocus) ? body.examFocus : []

    const initialTeamOwner = getInitialOwnerTeam('PARENT')
    const payload = {
      parentFullName,
      parentPhone: parentPhoneNormalized,
      parentPhoneNormalized,
      parentEmail: parentEmailNormalized,
      parentEmailNormalized,
      relationshipToLearner,
      learnerName,
      numberOfLearners: Number.isFinite(numberOfLearners) ? numberOfLearners : 1,
      learnerClass: typeof body.learnerClass === 'string' ? body.learnerClass : '',
      additionalLearners,
      learners,
      state: typeof body.state === 'string' ? body.state : '',
      lga: typeof body.lga === 'string' ? body.lga : '',
      area: typeof body.area === 'string' ? body.area : '',
      requestedSubjects,
      examFocus,
      lessonType: typeof body.lessonType === 'string' ? body.lessonType : '',
      preferredSchedule: typeof body.preferredSchedule === 'string' ? body.preferredSchedule.trim() : '',
      urgency: typeof body.urgency === 'string' ? body.urgency : '',
      additionalNotes: typeof body.additionalNotes === 'string' ? body.additionalNotes.trim() : '',
      consent: Boolean(body.consent),
      status: 'NEW',
      source: 'parent_form',
      leadSource:
        typeof body.leadSource === 'string' && body.leadSource.trim()
          ? body.leadSource.trim()
          : referralOwner.createdByUserId
            ? 'referral_link'
            : 'parent_form',
      referralCode: referralOwner.referralCode,
      createdByUserId: referralOwner.createdByUserId,
      createdByUserName: referralOwner.createdByUserName,
      leadType: 'PARENT',
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

    const created = await createParentRequestAtomic(payload)
    const assignment = await assignLeadRoundRobin({
      leadId: created.id,
      collectionName: PARENT_REQUESTS_COLLECTION,
      leadType: 'PARENT',
      createdByUserId: referralOwner.createdByUserId,
      createdByUserName: referralOwner.createdByUserName,
      teamOwner: initialTeamOwner,
      notes: 'Auto-assigned on parent lead creation.',
    })

    await logLeadActivity({
      collectionName: PARENT_REQUESTS_COLLECTION,
      leadId: created.id,
      leadType: 'PARENT',
      activityType: 'LEAD_CREATED',
      message: `Parent lead created for ${parentFullName}.`,
      userId: referralOwner.createdByUserId || 'system',
      userName: referralOwner.createdByUserName || 'System',
      nextStatus: 'NEW',
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
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
