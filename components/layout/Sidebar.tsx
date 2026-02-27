'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { getNavigationForRole } from '@/lib/config/roles'
import * as Icons from 'lucide-react'

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const sections = useMemo(() => {
    if (!user) return []
    return getNavigationForRole(user.role)
  }, [user])

  const getIcon = (iconName: string) => {
    const iconRegistry = Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>
    const IconComponent = iconRegistry[iconName]
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null
  }

  return (
    <aside className={`edunity-sidebar flex h-full flex-col transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-72'}`}>
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-3">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Image
              src="/edunity-logo.jpg"
              alt="Edunity"
              width={34}
              height={34}
              className="h-[34px] w-[34px] object-contain rounded-sm"
              priority
            />
            <div>
              <div className="text-sm font-semibold text-sidebar-foreground">Edunity</div>
              <div className="text-[11px] text-muted-foreground">Operations Workspace</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button onClick={onClose} className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.section} className="space-y-1">
            {!isCollapsed && <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{section.section}</p>}
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  {getIcon(item.icon)}
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
