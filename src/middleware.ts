import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // Add any additional middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Define protected routes
        const isProtectedRoute = 
          pathname.startsWith('/dashboard') ||
          pathname.startsWith('/mdt') ||
          (pathname.startsWith('/api/mdts') || pathname.startsWith('/api/mdt'));

        // Allow access if not a protected route or if user has token
        return !isProtectedRoute || !!token;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
}; 