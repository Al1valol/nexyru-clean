import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')

  const auth = request.headers.get('authorization')

  const USER = 'admin'
  const PASS = 'nexyru123' // change this

  if (isDashboard) {
    if (!auth) {
      return new NextResponse('Auth required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
      })
    }

    const base64 = auth.split(' ')[1]
    const [user, pass] = atob(base64).split(':')

    if (user !== USER || pass !== PASS) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
  }

  return NextResponse.next()
}