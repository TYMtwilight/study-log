export { auth as proxy } from '@/auth'

export const config = {
  /*
   * 以下を除くすべてのパスに適用する:
   * - api/auth（Auth.js のエンドポイント）
   * - _next/static, _next/image
   * - favicon.ico
   */
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
