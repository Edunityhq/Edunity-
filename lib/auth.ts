'use client'

import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onIdTokenChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase'

const AUTH_COOKIE_KEY = 'edunity_session'
const AUTH_COOKIE_AGE_SECONDS = 60 * 60 * 24 * 5

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function getFirebaseErrorCode(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code
  }

  return ''
}

async function persistSessionCookie(user: User, forceRefresh = false) {
  const token = await user.getIdToken(forceRefresh)
  setSessionCookie(token)
}

export async function loginWithEmailPassword(email: string, password: string) {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), normalizeEmail(email), password)
  await persistSessionCookie(result.user)
  return result.user
}

export async function waitForFirebaseAuthReady(): Promise<User | null> {
  const auth = getFirebaseAuth()
  if (auth.currentUser) return auth.currentUser

  return await new Promise((resolve) => {
    let timer = 0
    let unsubscribe = () => {}

    const finish = (user: User | null) => {
      window.clearTimeout(timer)
      unsubscribe()
      resolve(user)
    }

    unsubscribe = onIdTokenChanged(auth, (user) => {
      finish(user)
    })

    timer = window.setTimeout(() => {
      finish(auth.currentUser)
    }, 5000)
  })
}

export async function ensureFirebaseEmailPasswordSession(email: string, password: string) {
  const auth = getFirebaseAuth()
  const normalizedEmail = normalizeEmail(email)
  const currentUser = await waitForFirebaseAuthReady()

  if (currentUser?.email && normalizeEmail(currentUser.email) === normalizedEmail) {
    await persistSessionCookie(currentUser, true)
    return currentUser
  }

  if (currentUser) {
    await signOut(auth)
  }

  try {
    const result = await signInWithEmailAndPassword(auth, normalizedEmail, password)
    await persistSessionCookie(result.user)
    return result.user
  } catch (signInError) {
    try {
      const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
      await persistSessionCookie(result.user)
      return result.user
    } catch (createError) {
      const createCode = getFirebaseErrorCode(createError)
      if (createCode === 'auth/email-already-in-use' || createCode === 'auth/credential-already-in-use') {
        const signInCode = getFirebaseErrorCode(signInError)
        throw new Error(
          `Firebase authentication could not be established for ${normalizedEmail}${signInCode ? ` (${signInCode})` : ''}.`
        )
      }

      throw createError instanceof Error ? createError : signInError
    }
  }
}

export async function refreshSessionCookie() {
  const user = (await waitForFirebaseAuthReady()) ?? getFirebaseAuth().currentUser
  if (!user) return
  await persistSessionCookie(user, true)
}

export async function syncFirebasePassword(currentPassword: string, nextPassword: string) {
  const user = (await waitForFirebaseAuthReady()) ?? getFirebaseAuth().currentUser
  if (!user?.email) {
    throw new Error('Firebase session is missing. Please sign in again before changing your password.')
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, nextPassword)
  await persistSessionCookie(user, true)
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
