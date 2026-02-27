'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, LogOut, Menu, Search, UserCog } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#C4C3D0] bg-[#F7F4FA]/95 px-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="rounded-md p-1.5 text-[#4A0000] hover:bg-[#EDE6F1] lg:hidden">
          <Menu className="h-4 w-4" />
        </button>
        <div className="relative hidden w-80 md:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4A0000]/55" />
          <Input className="edunity-input pl-8" placeholder="Search leads, staff, notes..." />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="rounded-md p-1.5 text-[#4A0000]/75 hover:bg-[#EDE6F1]">
          <Bell className="h-4 w-4" />
        </button>
        <Badge
          variant="outline"
          className="hidden border-[#4A0000]/25 bg-[#4A0000]/10 text-[11px] text-[#4A0000] sm:inline-flex"
        >
          {user?.role === 'admin' ? 'Admin' : 'User'}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md p-1.5 hover:bg-[#EDE6F1]">
            <img
              src={user?.avatar}
              alt={user?.name}
              className="h-7 w-7 rounded-full border border-[#C4C3D0] object-cover"
            />
            <span className="hidden max-w-[120px] truncate text-xs text-[#4A0000]/70 sm:inline">
              {user?.name}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem disabled>
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {user?.role === 'admin' && (
              <DropdownMenuItem asChild>
                <Link href="/admin/staff">
                  <UserCog className="mr-2 h-4 w-4" />
                  Manage Users
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/dashboard">Main Dashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
