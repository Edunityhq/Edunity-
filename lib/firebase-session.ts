type FirebaseLookupResponse = {
  users?: Array<{
    localId: string
    email?: string
  }>
}

export type AuthenticatedUser = {
  uid: string
  email: string | null
}

export async function verifyFirebaseSession(idToken: string): Promise<AuthenticatedUser | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey || !idToken) return null

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    }
  )

  if (!response.ok) return null

  const data = (await response.json()) as FirebaseLookupResponse
  const user = data.users?.[0]
  if (!user) return null

  return {
    uid: user.localId,
    email: user.email ?? null,
  }
}

