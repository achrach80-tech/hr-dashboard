import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options })
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  // Get the user session
  const { data: { user }, error } = await supabase.auth.getUser()

  // Define protected routes
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
                          request.nextUrl.pathname.startsWith('/employees') ||
                          request.nextUrl.pathname.startsWith('/import') ||
                          request.nextUrl.pathname.startsWith('/settings')

  // Define auth routes
  const isAuthRoute = request.nextUrl.pathname === '/login' || 
                     request.nextUrl.pathname === '/signup'

  // Protect dashboard routes - redirect to login if not authenticated
  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages ONLY if they have a valid session
  // Check for error to ensure the session is actually valid
  if (isAuthRoute && user && !error) {
    // Also verify the user has a company before redirecting to dashboard
    const { data: company } = await supabase
      .from('etablissements')
      .select('id')
      .eq('user_id', user.id)
      .single()
    
    // Only redirect if they have a company set up
    if (company) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}