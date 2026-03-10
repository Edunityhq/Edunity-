import { NextResponse } from 'next/server'
import { assignLeadRoundRobin } from '@/lib/lead-routing'
import { logLeadActivity } from '@/lib/lead-audit'
import { getUsers } from '@/lib/auth/mock-users'
import { getInitialOwnerTeam } from '@/lib/lead-workflows'
import {
  createSchoolLeadAtomic,
  SCHOOL_LEAD_DUPLICATE_PHONE_ERROR,
  SCHOOL_LEAD_DUPLICATE_SCHOOL_PHONE_ERROR,
} from '@/lib/school-leads'
import { normalizeEmail, normalizePhoneNumber } from '@/lib/company-leads'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const schoolName = typeof body.schoolName === 'string' ? body.schoolName.trim() : ''
    const contactPerson = typeof body.contactPerson === 'string' ? body.contactPerson.trim() : ''
    const phoneNumber = normalizePhoneNumber(body.phoneNumber)
    const email = normalizeEmail(body.email)
    const location = typeof body.location === 'string' ? body.location.trim() : ''
    const createdByUserId = typeof body.createdByUserId === 'string' ? body.createdByUserId.trim() : ''
    const createdByUserName = typeof body.createdByUserName === 'string' ? body.createdByUserName.trim() : ''
    const allowDuplicateOverride = Boolean(body.allowDuplicateOverride)

    if (!schoolName || !contactPerson || !phoneNumber || !location) {
      return NextResponse.json(
        {
          ok: false,
          error: 'schoolName, contactPerson, phoneNumber, and location are required.',
        },
        { status: 400 }
      )
    }

    if (allowDuplicateOverride) {
      const actingUser = (await getUsers()).find((entry) => entry.id === createdByUserId)
      if (!actingUser || actingUser.role !== 'admin') {
        return NextResponse.json(
          {
            ok: false,
            error: 'Only admins can override a duplicate school lead.',
          },
          { status: 403 }
        )
      }
    }

    const initialTeamOwner = getInitialOwnerTeam('SCHOOL')
    const payload = {
      leadType: 'SCHOOL',
      schoolName,
      contactPerson,
      phoneNumber,
      phoneNumberNormalized: phoneNumber,
      email,
      location,
      state: typeof body.state === 'string' ? body.state.trim() : '',
      leadSource:
        typeof body.leadSource === 'string' && body.leadSource.trim() ? body.leadSource.trim() : 'school_outreach',
      createdByUserId,
      createdByUserName,
      referralCode: typeof body.referralCode === 'string' ? body.referralCode.trim() : '',
      status:
        typeof body.status === 'string' && body.status.trim() ? body.status.trim() : 'MEETING_ACCEPTED',
      isValid: body.isValid === false ? false : true,
      rejectionReason: typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : '',
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
      expectedRevenue: typeof body.expectedRevenue === 'string' ? body.expectedRevenue.trim() : '',
      nextActionDate: typeof body.nextActionDate === 'string' ? body.nextActionDate.trim() : '',
      nextActionNote: typeof body.nextActionNote === 'string' ? body.nextActionNote.trim() : '',
      currentTeamOwner: initialTeamOwner,
      assignedDepartment: initialTeamOwner,
      duplicateFlagReason: '',
      updatedAt: new Date().toISOString(),
    }

    const created = await createSchoolLeadAtomic(payload, { allowDuplicateOverride })
    const assignment = await assignLeadRoundRobin({
      leadId: created.id,
      collectionName: 'school_leads',
      leadType: 'SCHOOL',
      createdByUserId,
      createdByUserName,
      teamOwner: initialTeamOwner,
      notes: 'Auto-assigned on school lead creation.',
    })

    await logLeadActivity({
      collectionName: 'school_leads',
      leadId: created.id,
      leadType: 'SCHOOL',
      activityType: 'LEAD_CREATED',
      message: `School lead created for ${schoolName}.`,
      userId: createdByUserId || 'system',
      userName: createdByUserName || 'System',
      nextStatus: 'MEETING_ACCEPTED',
      teamOwner: initialTeamOwner,
      metadata: {
        schoolName,
        contactPerson,
        phoneNumber,
        assignmentId: assignment?.id ?? '',
        duplicateOverrideUsed: allowDuplicateOverride,
      },
    })

    if (allowDuplicateOverride) {
      await logLeadActivity({
        collectionName: 'school_leads',
        leadId: created.id,
        leadType: 'SCHOOL',
        activityType: 'DUPLICATE_OVERRIDE',
        message: 'Duplicate override used during school lead creation.',
        userId: createdByUserId || 'system',
        userName: createdByUserName || 'System',
        metadata: {
          phoneNumber,
          schoolName,
        },
      })
    }

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
    if (error instanceof Error && error.message === SCHOOL_LEAD_DUPLICATE_PHONE_ERROR) {
      return NextResponse.json(
        { ok: false, duplicatePhone: true, error: 'This phone number already exists on a school lead.' },
        { status: 409 }
      )
    }

    if (error instanceof Error && error.message === SCHOOL_LEAD_DUPLICATE_SCHOOL_PHONE_ERROR) {
      return NextResponse.json(
        {
          ok: false,
          duplicateSchoolPhone: true,
          error: 'This school name and phone number combination already exists.',
        },
        { status: 409 }
      )
    }

    if (error instanceof Error && error.message === 'MISSING_REQUIRED_SCHOOL_LEAD_KEYS') {
      return NextResponse.json(
        {
          ok: false,
          error: 'schoolName and phoneNumber are required.',
        },
        { status: 400 }
      )
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
