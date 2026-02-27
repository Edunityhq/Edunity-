import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Edunity internal dashboard for admin and assigned user leads.',
}

export default function DashboardRouteLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}
