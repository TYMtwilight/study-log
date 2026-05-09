import type { DefaultSession } from 'next-auth'

// Google OAuthは認証後にユーザー情報（名前・メール・画像・ID）を返す
// Auth.js がデフォルトで session.user に含めるのは name、email、image の3つだけなので、
// Auth.js がGoogle OAuthからIDを受け取れるよう、デフォルト Session 型を拡張する（モジュール拡張）
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
