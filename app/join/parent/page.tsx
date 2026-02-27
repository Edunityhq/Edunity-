import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ParentRequestForm from '@/components/parent-request-form'

export const metadata: Metadata = {
  title: 'Parent Request Form',
  description: 'Submit your learner tutoring request to Edunity.',
}

export default async function ParentJoinPage() {
  const host = ((await headers()).get('host') ?? '').toLowerCase()

  // Keep canonical parent-request host on "/" and avoid duplicate route content.
  if (host.includes('parent-request')) {
    redirect('/')
  }

  return <ParentRequestForm />
}
