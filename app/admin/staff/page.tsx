'use client'

import { useEffect, useState } from 'react'
import { useProtectedRoute } from '@/lib/auth/use-protected-route'
import {
  createUser,
  deleteUser,
  getUsers,
  resetUserPassword,
  MockUser,
  DEFAULT_PASSWORDS,
} from '@/lib/auth/mock-users'
import { useAuth } from '@/lib/auth/auth-context'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Role } from '@/lib/types'

export default function StaffDirectoryPage() {
  const { isLoading, hasAccess } = useProtectedRoute(['admin'])
  const { user } = useAuth()
  const [users, setUsers] = useState<MockUser[]>([])
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(DEFAULT_PASSWORDS.staff)
  const [role, setRole] = useState<Role>('marketing_staff')
  const [message, setMessage] = useState('')

  const refresh = async () => {
    setUsers(await getUsers())
  }

  useEffect(() => {
    void refresh()
  }, [])

  const handleCreate = async () => {
    setMessage('')
    if (!name.trim() || !username.trim()) {
      setMessage('Name and username are required.')
      return
    }

    try {
      await createUser({
        name,
        username,
        email,
        password,
        role,
      })
      await refresh()
      setName('')
      setUsername('')
      setEmail('')
      setPassword(role === 'admin' ? DEFAULT_PASSWORDS.admin : DEFAULT_PASSWORDS.staff)
      setRole('marketing_staff')
      setMessage('User created successfully.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create user.')
    }
  }

  const handleDelete = async (target: MockUser) => {
    if (target.id === user?.id) {
      setMessage('You cannot delete your own account while logged in.')
      return
    }

    const confirmed = window.confirm(`Delete ${target.name}?`)
    if (!confirmed) return

    try {
      await deleteUser(target.id)
      await refresh()
      setMessage(`${target.name} deleted.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to delete user.')
    }
  }

  const handleResetPassword = async (target: MockUser) => {
    try {
      const updated = await resetUserPassword(target.id)
      await refresh()
      setMessage(
        `${updated.name} password reset to ${
          updated.role === 'admin' ? DEFAULT_PASSWORDS.admin : DEFAULT_PASSWORDS.staff
        }.`
      )
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to reset password.')
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading staff...</div>
  if (!hasAccess) return null

  return (
    <div className="space-y-4">
      <div className="edunity-card p-4">
        <h1 className="text-base font-semibold">User Administration</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Admin-only: create users, delete users, and reset passwords to the system default.
        </p>
      </div>

      <div className="edunity-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Create New User</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            className="edunity-input"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            className="edunity-input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            className="edunity-input"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select
            value={role}
            onValueChange={(value) => {
              const castRole = value as Role
              setRole(castRole)
              setPassword(castRole === 'admin' ? DEFAULT_PASSWORDS.admin : DEFAULT_PASSWORDS.staff)
            }}
          >
            <SelectTrigger className="edunity-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="marketing_staff">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="edunity-input"
            type="text"
            placeholder="Temporary password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="edunity-button" onClick={handleCreate}>
            Create User
          </Button>
          <p className="text-xs text-muted-foreground">
            Default password for all new accounts: <span className="font-medium">{DEFAULT_PASSWORDS.staff}</span>.
            Everyone (including admin) can change it from Dashboard {'>'} Change Password.
          </p>
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
      </div>

      <div className="edunity-card p-4">
        <h2 className="text-sm font-semibold">Existing Users</h2>
        <div className="mt-3 space-y-2">
          {users.map((target) => (
            <div
              key={target.id}
              className="flex flex-col gap-3 rounded-md border border-border bg-white px-3 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{target.name}</p>
                <p className="text-xs text-muted-foreground">
                  @{target.username} | {target.email}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {target.role === 'admin' ? 'Admin' : 'User'} | {target.status}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResetPassword(target)}
                  className="h-8"
                >
                  Reset Password
                </Button>
                {target.id !== 'user_admin' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(target)}
                    className="h-8 text-red-700"
                  >
                    Delete User
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
