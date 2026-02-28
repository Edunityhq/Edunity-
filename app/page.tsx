import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ParentRequestForm from '@/components/parent-request-form'

export default async function Page() {
  const host = ((await headers()).get('host') ?? '').toLowerCase()
  const isParentRequestHost = host.includes('parent-request')
  const isTeacherUploadHost = host.includes('teacher-document') || host.endsWith(':3003')
  const isDashboardHost =
    host.includes('intra-edunity') ||
    host.includes('edunity-ui') ||
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1:') ||
    host.endsWith(':3000') ||
    host.endsWith(':3001') ||
    host.endsWith(':3002')

  if (isParentRequestHost) {
    return <ParentRequestForm />
  }

  if (isTeacherUploadHost) {
    redirect('/follow-up/upload')
  }

  redirect(isDashboardHost ? '/dashboard' : '/join/parent')
}
