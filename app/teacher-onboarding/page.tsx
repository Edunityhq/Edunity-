import type { Metadata } from 'next'
import TeacherOnboardingForm from '@/components/teacher-onboarding-form'

export const metadata: Metadata = {
  title: 'Teacher Onboarding',
  description: 'Submit your teacher onboarding form to Edunity.',
}

export default function TeacherOnboardingPage() {
  return <TeacherOnboardingForm />
}
