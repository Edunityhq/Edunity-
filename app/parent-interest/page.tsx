import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ParentRequestForm from '@/components/parent-request-form'
import { isParentRequestHost } from '@/lib/host-routing'

export const metadata: Metadata = {
  title: 'Parent Interest',
  description: 'Submit your learner tutoring request to Edunity.',
}

export default async function ParentInterestPage() {
  const host = ((await headers()).get('host') ?? '').toLowerCase()

  if (isParentRequestHost(host)) {
    redirect('/')
  }

  return <ParentRequestForm />
}
