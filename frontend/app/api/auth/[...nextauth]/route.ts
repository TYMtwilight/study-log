import { handlers } from '@/auth'

// /api/auth/* へのリクエストを Auth.js に移譲する
export const { GET, POST } = handlers
