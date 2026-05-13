import { handlers } from '@/auth'

// /api/auth/* へのリクエストを Auth.js に移譲する
/* 
    以下のエンドポイントが自動で動くようになる
    /api/auth/signin             ログイン画面へのリダイレクト
    /api/auth/signout            ログアウト処理
    /api/auth/callback/google/   Googleからの認証結果を受け取る
    /api/auth/session            現在のセッション情報を返す
*/
export const { GET, POST } = handlers
