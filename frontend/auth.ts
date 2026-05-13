import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  // providers:「どの方法でログインできるか」を設定
  providers: [Google],

  // pages: Auth.js が使う画面のパスを設定
  pages: {
    // 未認証時・ログイン画面のパス
    signIn: '/login',
    // 認証エラー時のリダイレクト先
    error: '/login',
  },

  // callbacks: Auth.js の処理の各タイミングに割り込む関数を設定
  callbacks: {
    // アクセス制御のタイミングでログイン済みか未ログインかをBoolean値で返す
    authorized({ auth }) {
      return !!auth
    },
    // JWT を作る・更新するタイミングで user.id をトークンに保存する
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    // クライアントが現在のセッション情報を要求するタイミングで
    // トークンの user.id をセッションオブジェクトに伝播する
    session({ session, token }) {
      session.user.id = token.id as string
      return session
    },
  },
})
