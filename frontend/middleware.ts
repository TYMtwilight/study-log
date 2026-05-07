export { auth as middleware } from '@/auth'

export const config = {
  /*
   * 以下を除くすべてのパスに適用する:
   * - api/auth
   * - _next/static, _next/image
   * - favicon.ico
   */
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
