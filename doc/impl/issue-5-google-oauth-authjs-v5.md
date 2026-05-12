# Google OAuth ログイン実装（Auth.js v5）実装手順

**対応 Issue:** [#5 \[Phase 1\] Google OAuth ログイン実装（Auth.js v5）](https://github.com/TYMtwilight/study-log/issues/5)  
**作成日:** 2026年4月28日  
**前提 Issue:** #1 Next.js 初期セットアップ

---

## Step 1 — Google Cloud Console の設定

Auth.js を動かす前に OAuth クレデンシャルを用意する。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成（または選択）する
2. **APIs & Services → OAuth consent screen** でアプリ情報を登録する
   - User Type: External
   - App name・サポートメール・デベロッパー連絡先を入力する
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** を選択する
   - Application type: **Web application**
   - Authorized redirect URIs に以下を追加する
     - 開発: `http://localhost:3000/api/auth/callback/google`
     - 本番: `https://<Cloud Run ドメイン>/api/auth/callback/google`
4. 発行された **Client ID** と **Client Secret** を控える

---

## Step 2 — パッケージインストール

```bash
cd frontend
npm install next-auth@latest react-icons
```

> **`react-icons` について**  
> Google など主要ブランドのSVGアイコンを React コンポーネントとして提供するライブラリ。`FaGoogle` は Font Awesome Brands に含まれる Google アイコン。SVGを手書きする必要がなくなる。

> **パッケージ名について**  
> Auth.js v5 は当初 `next-auth@beta` で提供されていた。インストール前に `npm show next-auth dist-tags` で `latest` タグが v5 以降（`5.x.x`）を指しているか確認すること。`latest` が v4 系を指している場合は `npm install next-auth@beta` を使う。

---

## Step 3 — 環境変数の設定

`frontend/.env.local` に追記する（`frontend/.env.local.example` も同様に更新する）。

```bash
# Auth.js v5
AUTH_SECRET=<openssl rand -base64 32 で生成した値>
AUTH_GOOGLE_ID=<Google Client ID>
AUTH_GOOGLE_SECRET=<Google Client Secret>

# Auth.js v5 は AUTH_URL を自動検出するが、本番では明示する
# AUTH_URL=https://<Cloud Run ドメイン>

# Spring Boot API
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

`AUTH_SECRET` の生成:

```bash
openssl rand -base64 32
```

> **`openssl rand -base64 32` の解説**  
> - `openssl rand <バイト数>`: 暗号論的に安全な乱数を指定バイト数だけ生成する  
> - `-base64`: 生成したバイト列を Base64 エンコードして文字列として出力する  
> - `32`: 256ビット（32バイト）の乱数を生成する。Auth.js が推奨する最小強度  
>
> 出力例: `K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=`  
> この文字列をそのまま `AUTH_SECRET` の値に貼り付ける。

> **v4 との変数名の違い**  
> v4: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`  
> v5: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`（プロバイダー名がプレフィックスになる）

---

## Step 4 — auth.ts の作成

プロジェクトルート（`frontend/auth.ts`）に作成する。

```typescript
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // middleware と連動してルート全体を保護する
    authorized({ auth }) {
      return !!auth
    },
    // サインイン時に user.id を JWT トークンに保存する
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    // JWT トークンの id をセッションオブジェクトに伝播する
    session({ session, token }) {
      session.user.id = token.id
      return session
    },
  },
})
```

> **`session.strategy` について**  
> DB アダプターを使用しない場合、Auth.js v5 はデフォルトで JWT 戦略を使用するため `session: { strategy: "jwt" }` の明示は不要。

### `handlers` / `auth` / `signIn` / `signOut` の役割

`NextAuth()` が返す 4 つのオブジェクトのそれぞれの役割と使い場所は次のとおり。

| 名前 | 種類 | 使う場所 |
|---|---|---|
| `handlers` | HTTP ハンドラー | Route Handler（`/api/auth/[...nextauth]/route.ts`） |
| `auth` | セッション取得関数 / ミドルウェア | サーバーコンポーネント・`middleware.ts` |
| `signIn` | ログイン開始関数 | Server Action |
| `signOut` | ログアウト関数 | Server Action |

**`handlers`**  
`/api/auth/*` のルートを処理する HTTP ハンドラー。Route Handler ファイルにそのままエクスポートして使う。これにより `/api/auth/signin`・`/api/auth/callback/google` などのエンドポイントが自動で動作する。

```typescript
// app/api/auth/[...nextauth]/route.ts
export const { GET, POST } = handlers
```

**`auth`**  
現在のセッション情報を取得する関数。サーバーコンポーネントや Server Action の中で呼び出す。また `middleware.ts` では `auth` 自体をミドルウェアとしてエクスポートして、未認証ユーザーのアクセス制御にも使う。

```typescript
// サーバーコンポーネント
const session = await auth()
// session.user.id, session.user.name, session.user.email が取れる

// middleware.ts
export { auth as middleware } from "@/auth"
```

**`signIn` / `signOut` を Server Action で使う理由**  
`signIn` / `signOut` は内部で HTTP レベルの 302 リダイレクトを返す。HTTP レスポンスのヘッダーを操作できるのはサーバー側だけであるため、これらの関数はサーバー上で実行する必要がある。

```
クライアント側でできること:
  window.location.href = "..." でページ遷移する（JavaScript の操作）

サーバー側でできること:
  HTTP レスポンスに Location ヘッダーを付けて 302 を返す（HTTP の仕組み）
```

フォームの `action` に Server Action（`"use server"` を付けた関数）を渡すと、ボタン押下時にサーバー側で関数が実行され、そのレスポンスとして HTTP リダイレクトを返せる。`"use server"` がなければブラウザ上で実行されようとするため、リダイレクトに失敗する。

```typescript
<form
  action={async () => {
    "use server"  // ← サーバー側で実行される
    await signIn("google", { redirectTo: "/" })
    // ↑ 302 リダイレクトを HTTP レスポンスとして返す
  }}
>
  <button type="submit">Google でログイン</button>
</form>
```

---

## Step 5 — Route Handler の作成

`frontend/app/api/auth/[...nextauth]/route.ts` を作成する。

```typescript
import { handlers } from "@/auth"

export const { GET, POST } = handlers
```

> **`[...nextauth]` フォルダ名の意味**  
> Next.js の App Router では、フォルダ名を `[...name]` にするとそれ以降のすべてのパスを1つのファイルで受け取れる（キャッチオールルート）。
>
> ```
> /api/auth/signin          ┐
> /api/auth/signout         ├── すべてこのファイルが処理する
> /api/auth/callback/google ┘
> ```

Auth.js v5 では、`handlers` をエクスポートするだけで `/api/auth/*` の全ルートが自動的に動作する。

---

## Step 5.5 — middleware.ts の作成

**全ルートを認証必須にするための middleware**。これがないと未ログインユーザーが保護ページへアクセスできる。

プロジェクトルート（`frontend/middleware.ts`）に作成する。

> **Next.js 16 での `middleware.ts` の取り扱いについて**  
> Next.js 16 では `middleware.ts` が **`proxy.ts` に改名・非推奨化** された。ただし `proxy.ts` は Node.js runtime 専用であり、**Edge runtime はサポートされない**。Auth.js v5 は Edge runtime で動作するため、Next.js 16 環境でも **`middleware.ts` を使い続けることが正しい選択**。v16 アップグレードガイドも「Edge runtime を使い続けたい場合は `middleware` を使うこと」と明記している。

```typescript
export { auth as middleware } from "@/auth"

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのパスに適用する:
     * - api/auth（Auth.js のコールバックルート）
     * - _next/static, _next/image（Next.js 静的アセット）
     * - favicon.ico
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
```

`authorized` コールバックが `false` を返すと、Auth.js が自動的に `pages.signIn`（`/login`）へリダイレクトする。

---

## Step 6 — TypeScript 型の拡張

`frontend/types/next-auth.d.ts` を作成し、`session.user.id` の型を追加する。

```typescript
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
  }
}
```

---

## Step 7 — ログイン画面の実装

`frontend/app/(auth)/login/page.tsx` を作成する。

```typescript
import { auth, signIn } from "@/auth"
import { redirect } from "next/navigation"
import { FaGoogle } from "react-icons/fa"

export default async function LoginPage({
  searchParams,
}: {
  // Next.js 15 では searchParams は Promise
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()

  // ログイン済みならダッシュボードへ
  if (session) redirect("/")

  const { error } = await searchParams
  const hasError = !!error

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          ログイン
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500">
          Google アカウントでログインしてアプリにアクセスします
        </p>

        {hasError && (
          <p className="mb-4 text-center text-sm text-red-500">
            ログインに失敗しました。もう一度お試しください。
          </p>
        )}

        {/* Server Action でサインインを呼び出す */}
        <form
          action={async () => {
            "use server"
            await signIn("google", { redirectTo: "/" })
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <FaGoogle className="h-5 w-5 text-[#4285F4]" />
            Google でログイン
          </button>
        </form>
      </div>
    </div>
  )
}
```

> **`searchParams` に `error` を定義している理由**  
> Auth.js v5 はログイン失敗時に `pages.error` で指定したページ（ここでは `/login`）へリダイレクトする際、失敗理由を `?error=...` クエリパラメータとして自動付与する。  
> 例: `/login?error=OAuthCallbackError`  
> このパラメータを受け取ってエラーメッセージを表示するために `error` を定義している。
>
> | `error` の値 | 意味 |
> |---|---|
> | `OAuthCallbackError` | OAuth コールバックでエラー |
> | `OAuthAccountNotLinked` | 別プロバイダーで登録済みのメール |
> | `AccessDenied` | アクセス拒否 |
>
> また、Next.js 15 では `searchParams` 全体が `Promise` になったため、型も `Promise<{ error?: string }>` となり `await` が必要になっている（詳細は Next.js 15 の Partial Prerendering 対応による変更）。

---

## Step 8 — ルートレイアウトへの SessionProvider 追加

Auth.js v5 では `SessionProvider` の設定は任意だが、クライアントコンポーネントで `useSession()` を使う場合は必要。

`frontend/app/layout.tsx` を更新する。

```typescript
import type { Metadata } from "next"
import { SessionProvider } from "next-auth/react"
import "./globals.css"

export const metadata: Metadata = {
  title: "学習ログ",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

---

## Step 9 — セッション取得パターン

実装中に使うパターンをまとめる。

### サーバーコンポーネント（推奨）

```typescript
import { auth } from "@/auth"

export default async function SomePage() {
  const session = await auth()
  // session.user.id, session.user.name, session.user.email, session.user.image
}
```

### クライアントコンポーネント

```typescript
"use client"
import { useSession } from "next-auth/react"

export function UserInfo() {
  const { data: session, status } = useSession()
  if (status === "loading") return <p>Loading...</p>
  if (!session) return null
  return <p>{session.user.name}</p>
}
```

### Spring Boot API へのトークン渡し

Auth.js v5 のセッション JWT を Spring Boot に渡す方法は **Issue #16（JWT 認証フィルター）・Issue #20（API 結合確認）** で確定する。  
現時点では `session.user.id` がサーバーサイドで取得できれば Issue #5 の完了条件を満たす。

---

## Step 10 — 動作確認

```bash
cd frontend
npm run dev
```

| 確認項目 | 手順 | 期待結果 |
|---------|------|---------|
| 未認証リダイレクト | 未ログイン状態で `http://localhost:3000/` へアクセス | `/login` へリダイレクトされる |
| ログイン画面表示 | `http://localhost:3000/login` へアクセス | 「Google でログイン」ボタンが表示される |
| ログイン成功後のリダイレクト | ボタンをクリックして Google 認証を完了 | `/` へ遷移する |
| ログイン済みで `/login` にアクセス | ログイン後に `/login` へ直接アクセス | `/` へリダイレクトされる |
| セッション情報取得 | ダッシュボードで `auth()` を呼ぶ | `name`, `email`, `image`, `id` が取得できる |
| 認証エラー | 無効な OAuth フローを再現 | `/login?error=...` へリダイレクトされる |

---

## Step 11 — テストコードの作成

`frontend/app/(auth)/login/page.test.tsx` を作成する。

### モックが必要な理由

`LoginPage` は内部で 2 つの外部依存を呼ぶが、それぞれ **Jest/jsdom 環境では動かない具体的な理由**がある。

| 依存 | テスト環境で起きること | 対処 |
|---|---|---|
| `auth()` from `@/auth` | Cookie や JWT を読む HTTP リクエストコンテキストが Jest/jsdom に存在しないため、結果が不定または実行エラーになる | `jest.fn()` で差し替えて戻り値を制御する |
| `redirect()` from `next/navigation` | Next.js の内部実装が `NEXT_REDIRECT` という特殊エラーをスローする仕組みになっており、モックしないとテストがそこでクラッシュする | `jest.fn()` で差し替えて何もしない関数にする |

### テストコード

```typescript
import { render, screen } from '@testing-library/react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

import LoginPage from '@/app/(auth)/login/page'

jest.mock('@/auth', () => ({
  auth: jest.fn(),
  signIn: jest.fn(),
}))
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('Google でログインボタンが表示される', async () => {
    (auth as jest.Mock).mockResolvedValue(null)  // セッションなし = 未ログイン → redirect("/") がスキップされてボタンの描画まで到達する
    render(await LoginPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('button', { name: /Google でログイン/ })).toBeInTheDocument()
  })

  test('error パラメーターがある場合はエラーメッセージが表示される', async () => {
    (auth as jest.Mock).mockResolvedValue(null)  // セッションなし = 未ログイン → redirect("/") がスキップされてボタンの描画まで到達する
    render(await LoginPage({ searchParams: Promise.resolve({ error: 'OAuthCallbackError' }) }))
    expect(screen.getByText(/ログインに失敗しました/)).toBeInTheDocument()
  })

  test('error パラメーターがない場合はエラーメッセージが表示されない', async () => {
    (auth as jest.Mock).mockResolvedValue(null)
    render(await LoginPage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByText(/ログインに失敗しました/)).not.toBeInTheDocument()
  })

  test('ログイン済みの場合は / へリダイレクトされる', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: '1', name: 'テストユーザー', email: 'test@example.com' } })
    await LoginPage({ searchParams: Promise.resolve({}) })
    expect(jest.mocked(redirect)).toHaveBeenCalledWith('/')
  })
})
```

> **`render(await LoginPage({...}))` の意味**  
> `LoginPage` は非同期サーバーコンポーネントなので、`<LoginPage />` で JSX 記法で渡しても React Testing Library が同期的にレンダリングできない場合がある。`await LoginPage({...})` でコンポーネント関数を先に評価して JSX を取得し、その結果を `render()` に渡すことで確実に動作する。

> **`auth as jest.Mock` とキャストしている理由**  
> `jest.mocked(auth)` が型推論上の理想だが、next-auth の `auth` は複数のオーバーロードを持つ複雑な関数であり、`jest.mocked()` がすべてのオーバーロードの交差型を解決しようとした結果 `never` になってしまう。`as jest.Mock` で強制的にモック関数の型に変換することで回避している。`redirect` は単純な関数型のため `jest.mocked()` がそのまま使える。

### テストの実行

```bash
cd frontend
npx jest app/\(auth\)/login/page.test.tsx
```

---

## 完了条件チェック

| 完了条件 | 対応ステップ |
|---------|------------|
| `auth.ts` で Auth.js v5 を設定し Google プロバイダーを追加 | Step 4 |
| 全ルートをログイン必須にする（未認証は `/login` へリダイレクト） | Step 5.5 |
| ログイン画面（`/login`）を実装（「Google でログイン」ボタン） | Step 7 |
| OAuth 認証成功後に `/` へリダイレクト | Step 7（`redirectTo: "/"` ） |
| 認証失敗時にエラーメッセージを表示 | Step 4（`pages.error: "/login"`）、Step 7（`?error` パラメータで表示） |
| セッション情報（name, email, image）をフロント側で取得できる | Step 9, 10 |
| ログインページのテストコードを作成（3 ケース） | Step 11 |
