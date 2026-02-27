import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ParentRequestForm from '@/components/parent-request-form'

export default async function Page() {
  const host = ((await headers()).get('host') ?? '').toLowerCase()
  const isParentRequestHost = host.includes('parent-request')
  const isDashboardHost =
    host.includes('intra-edunity') ||
    host.includes('edunity-ui') ||
    host.endsWith(':3000') ||
    host.endsWith(':3001')

  if (isParentRequestHost) {
    return <ParentRequestForm />
  }

  redirect(isDashboardHost ? '/dashboard' : '/join/parent')
}
