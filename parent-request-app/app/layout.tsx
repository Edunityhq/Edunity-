import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Edunity Parent Request',
  description: 'Parent request intake form',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
