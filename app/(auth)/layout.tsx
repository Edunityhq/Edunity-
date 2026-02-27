'use client';

import { ThemeProvider } from '@/lib/theme/theme-provider';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}
