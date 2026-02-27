import type { Metadata } from 'next'
import ParentRequestForm from '@/components/parent-request-form'

export const metadata: Metadata = {
  title: 'Parent Request Form',
  description: 'Submit your learner tutoring request to Edunity.',
}

export default function ParentJoinPage() {
  return <ParentRequestForm />
}