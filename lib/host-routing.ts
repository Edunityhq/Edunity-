const DASHBOARD_CUSTOM_HOSTS = new Set(['intra.edunitytechnologies.online'])

function normalizeHostValue(host: string | null | undefined): string {
  return (host ?? '').trim().toLowerCase()
}

function extractHostname(host: string): string {
  if (!host) return ''

  try {
    return new URL(`http://${host}`).hostname.toLowerCase()
  } catch {
    return host.split(':')[0]?.toLowerCase() ?? ''
  }
}

export function isParentRequestHost(host: string | null | undefined): boolean {
  const hostname = extractHostname(normalizeHostValue(host))
  return hostname.includes('parent-request')
}

export function isTeacherUploadHost(host: string | null | undefined): boolean {
  const hostValue = normalizeHostValue(host)
  const hostname = extractHostname(hostValue)
  return hostname.includes('teacher-document') || hostValue.endsWith(':3003')
}

export function isDashboardHost(host: string | null | undefined): boolean {
  const hostValue = normalizeHostValue(host)
  const hostname = extractHostname(hostValue)

  return (
    DASHBOARD_CUSTOM_HOSTS.has(hostname) ||
    hostname.includes('intra-edunity') ||
    hostname.includes('edunity-ui') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostValue.endsWith(':3000') ||
    hostValue.endsWith(':3001') ||
    hostValue.endsWith(':3002')
  )
}
