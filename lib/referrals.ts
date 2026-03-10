import { getUsers } from '@/lib/auth/mock-users'

function normalizeReferralCode(value: string): string {
  return value.trim().toLowerCase()
}

export async function resolveReferralOwner(referralCode: string) {
  const normalized = normalizeReferralCode(referralCode)
  if (!normalized) {
    return {
      referralCode: '',
      createdByUserId: '',
      createdByUserName: '',
    }
  }

  const users = await getUsers()
  const owner =
    users.find((user) => user.id.toLowerCase() === normalized) ??
    users.find((user) => user.username.toLowerCase() === normalized) ??
    users.find((user) => user.email.toLowerCase() === normalized)

  return {
    referralCode: normalized,
    createdByUserId: owner?.id ?? '',
    createdByUserName: owner?.name ?? '',
  }
}
