import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ParentRequestForm from '@/components/parent-request-form'
import { isDashboardHost, isParentRequestHost, isTeacherUploadHost } from '@/lib/host-routing'

export default async function Page() {
  const host = ((await headers()).get('host') ?? '').toLowerCase()

  if (isParentRequestHost(host)) {
    return <ParentRequestForm />
  }

  if (isTeacherUploadHost(host)) {
    redirect('/follow-up/upload')
  }

  redirect(isDashboardHost(host) ? '/dashboard' : '/join/parent')
}
