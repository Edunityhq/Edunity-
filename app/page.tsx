import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import ParentRequestForm from '@/components/parent-request-form'

export default async function Page() {
  const host = (await headers()).get('host') ?? ''
  const isDashboardHost = host.endsWith(':3001')
  const isParentRequestHost = host.includes('parent-request')

  if (isParentRequestHost) {
    return <ParentRequestForm />
  }

  redirect(isDashboardHost ? '/dashboard' : '/join/parent')
}
