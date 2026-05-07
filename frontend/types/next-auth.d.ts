import type { DefaultSession } from 'next-auth'

// Auth.js のデフォルト Session 型を拡張する（モジュール拡張）
declare module 'next-auth' {
  interface Session {
    user: {
      id: string // auth()、useSession() で session.user.id を参照できるようにする
    } & DefaultSession['user'] // name、email、image などデフォルトのプロパティを維持する
  }
}

// Auth.js の JWT 型を拡張する（モジュール拡張）
declare module 'next-auth/jwt' {
  interface JWT {
    id: string // jwt コールバックで token.id に代入できるようにする
  }
}
