'use client'

import { useEffect } from 'react'
import { onIdTokenChanged } from 'firebase/auth'
import { clearSessionCookie, setSessionCookie } from '@/lib/auth'
import { getFirebaseAuth } from '@/lib/firebase'

export default function AuthSessionSync() {
  useEffect(() => {
    const auth = getFirebaseAuth()
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        clearSessionCookie()
        return
      }

      const token = await user.getIdToken()
      setSessionCookie(token)
    })

    return unsubscribe
  }, [])

  return null
}
