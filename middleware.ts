import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = (request.headers.get('host') ?? '').toLowerCase()
  const isParentRequestHost = host.includes('parent-request')

  if (isParentRequestHost && pathname === '/join/parent') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/join/parent'],
}
