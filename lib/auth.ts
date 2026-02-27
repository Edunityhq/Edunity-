'use client'

import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase'

const AUTH_COOKIE_KEY = 'edunity_session'
const AUTH_COOKIE_AGE_SECONDS = 60 * 60 * 24 * 5

export async function loginWithEmailPassword(email: string, password: string) {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  const token = await result.user.getIdToken()
  setSessionCookie(token)
  return result.user
}

export async function refreshSessionCookie() {
  const auth = getFirebaseAuth()
  if (!auth.currentUser) return
  const token = await auth.currentUser.getIdToken(true)
  setSessionCookie(token)
}

export async function logout() {
  clearSessionCookie()
  await signOut(getFirebaseAuth())
}

export function setSessionCookie(token: string) {
  document.cookie = `${AUTH_COOKIE_KEY}=${token}; Path=/; Max-Age=${AUTH_COOKIE_AGE_SECONDS}; SameSite=Lax; Secure`
}

export function clearSessionCookie() {
  document.cookie = `${AUTH_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax; Secure`
}
