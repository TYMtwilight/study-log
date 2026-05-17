# Issue #7 ログアウト機能実装手順書

**対象イシュー：** [Phase 1] ログアウト機能実装  
**関連要件：** CLAUDE.md §3.1 F-01 / テスト仕様書 §2 AUTH-11  
**更新日：** 2026-05-16

---

## 1. 完了条件の確認

| #   | 条件                                                                          |
| --- | ----------------------------------------------------------------------------- |
| 1   | ヘッダーの「ログアウト」ボタン押下でセッションを破棄する（Auth.js `signOut`） |
| 2   | ログアウト後に `/login` へリダイレクトする                                    |
| 3   | ログアウト後に `/` へ直接アクセスしても `/login` へ戻ることを確認する         |

条件 3 はミドルウェア（`proxy.ts` の `authorized` コールバック）が既に実装済みのため、  
**本イシューの実装スコープは条件 1・2** のみ。

---

## 2. 実装ファイル一覧

| 操作         | ファイル                                 | 内容                                              |
| ------------ | ---------------------------------------- | ------------------------------------------------- |
| **新規作成** | `app/(protected)/layout.tsx`             | 認証済みページ共通レイアウト（Header を組み込む） |
| **新規作成** | `app/(protected)/page.tsx`               | ダッシュボード（`app/page.tsx` を移動）           |
| **新規作成** | `app/(protected)/_components/Header.tsx` | ログアウトボタンを含むヘッダー Server Component   |
| **削除**     | `app/page.tsx`                           | `app/(protected)/page.tsx` へ移動するため削除     |
| **更新**     | `next.config.ts`                         | Google CDN の `remotePatterns` を追加             |
| **新規作成** | `e2e/fixtures/auth-file.ts`              | `authFile` パスの定義のみを持つ定数ファイル       |
| **新規作成** | `e2e/fixtures/auth.setup.ts`             | Playwright 認証済み状態セットアップ               |
| **新規作成** | `e2e/logout.spec.ts`                     | AUTH-11 E2E テスト                                |
| **更新**     | `playwright.config.ts`                   | `setup` プロジェクトの追加                        |

### なぜ `(protected)` ルートグループを作るか

`app/layout.tsx`（ルートレイアウト）にヘッダーを置くと `/login` にもヘッダーが表示されてしまう。  
`(protected)` ルートグループで認証済みページ専用のレイアウトを持つことで、ログイン画面とレイアウトを分離できる。

---

## 3. 実装ステップ

### Step 1 — ルートグループの整備

#### 1-1. `app/(protected)/` ディレクトリを作成

```
app/
├── (auth)/
│   └── login/
│       └── page.tsx       ← 既存（変更なし）
├── (protected)/
│   ├── _components/
│   │   └── Header.tsx     ← 新規
│   ├── layout.tsx         ← 新規
│   └── page.tsx           ← 既存の app/page.tsx を移動
├── layout.tsx             ← 既存（変更なし）
└── globals.css            ← 既存（変更なし）
```

#### 1-2. `app/page.tsx` の内容を `app/(protected)/page.tsx` に移動

```tsx
// app/(protected)/page.tsx
export default function Home() {
  return <div>ダッシュボード</div>;
}
```

その後 `app/page.tsx` は削除する。

---

### Step 2 — Header コンポーネントの作成

#### 2-1. `app/(protected)/_components/Header.tsx`

ポイント：

- `auth()` でサーバーサイドのセッションを取得する Async Server Component
- ログアウトボタンは `<form>` + Server Action で実装する（`signIn` と同じパターン）
- `signOut({ redirectTo: '/login' })` でセッション破棄 → `/login` へリダイレクト

```tsx
// app/(protected)/_components/Header.tsx
import Image from "next/image";
import Link from "next/link";

import { auth, signOut } from "@/auth";

export default async function Header() {
  const session = await auth();

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-white shadow-sm">
      <Link href="/" className="text-lg font-bold text-gray-900">
        STUDY LOG
      </Link>

      <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
        <Link href="/" className="hover:text-gray-900">
          ダッシュボード
        </Link>
        <Link href="/study-logs" className="hover:text-gray-900">
          学習ログ
        </Link>
        <Link href="/subjects" className="hover:text-gray-900">
          科目管理
        </Link>
        <Link href="/reports/monthly" className="hover:text-gray-900">
          CSVダウンロード
        </Link>
        <Link href="/batch-history" className="hover:text-gray-900">
          バッチ履歴
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        {session?.user?.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? "ユーザー"}
            width={32}
            height={32}
            className="rounded-full"
          />
        )}
        <span className="text-sm text-gray-700">{session?.user?.name}</span>

        {/* Server Action でサインアウトを呼び出す */}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-1 text-sm
              text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            ログアウト
          </button>
        </form>
      </div>
    </header>
  );
}
```

**`'use server'` について：**

フォームのボタンを押すのはブラウザ（クライアント）。ブラウザはサーバーのコードを直接呼べないため、Next.js が間に入って「このURLにPOSTしたらこの関数を実行する」という専用エンドポイントを自動生成する。`'use server'` はその指示であり、「この関数をエンドポイントとして登録して」と Next.js に伝えている。

`signOut` 自体はただのサーバー関数なので、エンドポイント登録（`'use server'`）は不要。`auth.ts` に `'use server'` が書かれていないのも同じ理由。

**`signOut` の引数について：**

| 引数                   | 説明                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redirectTo: '/login'` | セッション破棄後のリダイレクト先。省略すると Auth.js がデフォルト（`/`）にリダイレクトし、ミドルウェアが `/login` に転送する二重リダイレクトが起きる。明示指定が望ましい。 |

#### 2-2. `app/(protected)/layout.tsx`

```tsx
// app/(protected)/layout.tsx
import Header from "./_components/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </>
  );
}
```

#### 2-3. `next.config.ts` の更新

`next/image` で Google プロフィール画像を読み込むため、`remotePatterns` に許可ドメインを追加する。  
設定がないと本番ビルドで `Error: Invalid src prop` が発生する。

`lh3.googleusercontent.com` は Google でログインしたときに `session.user.image` へ入るプロフィール画像の配信元ドメイン。`lh3` は Google の画像ホスティングサーバーの識別子で、`googleusercontent.com` が Google のユーザーコンテンツ配信ドメイン。

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
```

`port: ''` は標準ポート（443）のみ許可し、`:8080` などの非標準ポートからの画像を拒否する。`pathname: '/**'` は Google のプロフィール画像URLがリクエストごとにパスが異なるため、配下の全パスを許可するワイルドカード指定。

---

### Step 3 — E2E テストフィクスチャーの整備

E2E テストでログアウトを検証するには、まず「ログイン済み状態」を作る必要がある。しかし毎回 Google のログイン画面を実際に操作するのはテストの自動化として現実的でない。

ブラウザがログイン済みかどうかは**セッションクッキーの有無**で判定される。そのため、テスト側でセッションクッキーをブラウザに直接注入すれば、Google を通らずにログイン済み状態を作れる。

ただし、セッションクッキーの中身はそのままユーザー情報が入っているわけではなく、Auth.js が `AUTH_SECRET`（アプリだけが知っている秘密の文字列）を使って「このデータは本物です」という証明を付けた形式になっている。でたらめな値を注入しても Auth.js に偽物と判定されて弾かれる。

`@auth/core/jwt` の `encode` 関数は Auth.js 自身がセッションクッキーを生成するときに呼び出している関数。テストコードからこの関数を同じ `AUTH_SECRET` で呼べば、Auth.js が本物として受け入れるクッキーを生成できる。

#### 3-1. `e2e/fixtures/auth-file.ts` を作成

`authFile` 定数（ストレージ状態の保存先パス）を定義するだけのファイル。

`.auth` は Unix 系 OS の慣習で「隠しフォルダ」を意味するプレフィックス。セッションクッキー（認証情報）を含むファイルのため、誤ってコミットされないよう隠しフォルダに配置する。Playwright の公式ドキュメントでも `.auth/` という名前が使われている慣習に倣っている。

```ts
// e2e/fixtures/auth-file.ts
export const authFile = "e2e/fixtures/.auth/user.json";
```

**なぜ専用ファイルに分離するか：**

`authFile` 定数は `playwright.config.ts`（テスト設定）と `auth.setup.ts`（セットアップ処理）の両方で使う。当初は `auth.setup.ts` で `export const authFile = ...` と定義して `playwright.config.ts` からインポートしていたが、次のエラーが発生した：

```
Error: Playwright Test did not expect test() to be called here.
```

`auth.setup.ts` では `setup()` = `test()` を呼び出しており、`playwright.config.ts` が `auth.setup.ts` をインポートするだけで `test()` がモジュールロード時に実行されてしまう。Playwright はテスト設定ファイルのロード中に `test()` が呼ばれることを想定していないためこのエラーになる。

定数だけを切り出した `auth-file.ts` を作り、両方のファイルからインポートすることでこの問題を解消する。

#### 3-2. `e2e/fixtures/auth.setup.ts` を作成

このファイル全体でやっていることは一つ。**「テスト用のログイン済みクッキーを作ってブラウザに注入し、ファイルに保存する」**。3つのステップに分かれている。

1. `encode()` でテスト用セッションクッキーの値を生成する
2. `addCookies()` でそのクッキーをブラウザに注入する（これでブラウザが「ログイン済み」になる）
3. `storageState()` でその状態をファイルに書き出す（`logout.spec.ts` がこのファイルを読み込んでログイン済み状態でテストを開始する）

```ts
// e2e/fixtures/auth.setup.ts
import { test as setup } from "@playwright/test";
import { encode } from "@auth/core/jwt";
import { authFile } from "./auth-file";

setup("認証済み状態のセットアップ", async ({ page }) => {
  // ① Auth.js と同じ encode() 関数・同じ AUTH_SECRET を使ってセッションクッキーの値を生成する。
  //    Auth.js はクッキーを受け取るたびに AUTH_SECRET で検証するため、
  //    同じ関数・同じ SECRET で生成すれば「本物」として受け入れられる。
  const sessionToken = await encode({
    token: {
      name: "テストユーザー", // ユーザーの表示名
      email: "test@example.com", // メールアドレス
      picture: null, // プロフィール画像URL（テストでは不要なので null）
      sub: "test-user-id", // Auth.js がユーザーを一意に識別する ID
      id: "test-user-id", // auth.ts の jwt コールバックで追加したカスタムフィールド（token.id）
    },
    secret: process.env.AUTH_SECRET!,
    // Auth.js はセッションクッキーを検証するとき、
    // クッキーの値だけでなくクッキー名（authjs.session-token）も検証の計算に組み込んでいる。
    // encode() でトークンを生成するときも同じクッキー名を渡さないと
    // 計算結果がずれて Auth.js に偽物と判定される。
    salt: "authjs.session-token",
  });

  // ② 生成したクッキーをブラウザに直接注入する。これでブラウザが「ログイン済み」の状態になる。
  await page.context().addCookies([
    {
      name: "authjs.session-token", // クッキーの名前。Auth.js がこの名前でセッションを探す
      value: sessionToken, // クッキーの中身。①で生成したトークン
      domain: "localhost", // このクッキーを送るドメイン。テスト対象が localhost で動くため
      path: "/", // このクッキーを送るパス。/ はすべてのパスに送ることを意味する
      httpOnly: true, // JavaScript からクッキーを読み取れなくする。Auth.js のデフォルトに合わせる
      secure: false, // true にすると HTTPS のときだけ送る。ローカルは HTTP なので false
      sameSite: "Lax", // 別サイトからの POST ではクッキーを送らない。Auth.js のデフォルトに合わせる
    },
  ]);

  // ③ ブラウザのクッキー状態をファイルに書き出す。
  //    storageState はブラウザが持つデータ（クッキー・localStorage など）の状態をまるごとファイルに保存・復元する Playwright の機能。
  //    auth.setup.ts（事前準備）と logout.spec.ts（テスト本体）は別プロセスで実行されるため、
  //    プロセスをまたいでブラウザの状態を引き継ぐにはいったんファイルに書き出す必要がある。
  //    logout.spec.ts は playwright.config.ts の storageState: authFile の設定によって
  //    このファイルをテスト開始時に自動で読み込むため、最初からログイン済み状態でテストが始まる。
  await page.context().storageState({ path: authFile });
});
```

**注意点：**

- `AUTH_SECRET` は `.env.local` に設定済みの値を使う（テスト実行時に環境変数として渡す）
- `e2e/fixtures/.auth/` は `.gitignore` に追加してトークンをコミットしないこと

#### 3-3. `.gitignore` に追記

```
# E2E 認証フィクスチャー（セッショントークンを含む）
e2e/fixtures/.auth/
```

---

### Step 4 — `playwright.config.ts` の更新

`setup` プロジェクトを追加し、認証済みテストが必ずセットアップ後に実行されるようにする。

また、`dotenv` で `.env.local` を明示的に読み込む。Next.js は起動時に `.env.local` を自動で読むが、Playwright のテストランナーは別プロセスのため自動では読み込まない。設定しないと `auth.setup.ts` が `AUTH_SECRET` を `undefined` として受け取り、`encode()` が `TypeError: "ikm" must be an instance of Uint8Array or a string` で失敗する。

```bash
npm install --save-dev dotenv
```

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { authFile } from "./e2e/fixtures/auth-file";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  globalTimeout: process.env.CI ? 60 * 60 * 1000 : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "on-failure" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // 認証済みセットアップ（他のプロジェクトより先に実行）
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // 認証不要テスト（未認証リダイレクト・ログインページ）
    {
      name: "chromium-public",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /logout\.spec\.ts/,
    },
    // 認証済みテスト（logout など）
    {
      name: "chromium-auth",
      use: {
        ...devices["Desktop Chrome"],
        storageState: authFile,
      },
      testMatch: /logout\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      ...process.env,
      AUTH_TRUST_HOST: "true",
    },
  },
});
```

---

### Step 5 — `e2e/logout.spec.ts` の実装

```ts
// e2e/logout.spec.ts
import { test, expect } from "@playwright/test";

/**
 * AUTH-11: ログアウトでセッション破棄
 * storageState = e2e/fixtures/.auth/user.json（playwright.config.ts の chromium-auth プロジェクト）
 */
test.describe("ログアウト（AUTH-11）", () => {
  test("ヘッダーのログアウトボタンを押すと /login へ遷移する", async ({
    page,
  }) => {
    // 認証済み状態でダッシュボードへ
    await page.goto("/");
    await expect(page).toHaveURL("/");

    // ヘッダーのログアウトボタンをクリック
    await page.getByRole("button", { name: "ログアウト" }).click();

    // /login へリダイレクトされることを確認
    await expect(page).toHaveURL(/\/login/);
  });

  test("ログアウト後に / へ直接アクセスすると /login へリダイレクトされる", async ({
    page,
    context,
  }) => {
    // ログアウト（セッションクッキーを削除）
    await page.goto("/");
    await page.getByRole("button", { name: "ログアウト" }).click();
    await expect(page).toHaveURL(/\/login/);

    // 新しいページで / に直接アクセス
    const newPage = await context.newPage();
    await newPage.goto("/");
    await expect(newPage).toHaveURL(/\/login/);
  });
});
```

---

## 4. 動作確認手順

### ローカルでの手動確認

```bash
# 開発サーバーを起動
npm run dev

# ブラウザで確認
# 1. http://localhost:3000 にアクセス → /login へリダイレクト
# 2. Google ログイン → ダッシュボードへ遷移
# 3. ヘッダーにユーザー名・アイコンとログアウトボタンが表示されている
# 4. ログアウトボタンを押す → /login へ遷移
# 5. ブラウザの戻るボタンで / へ → /login へリダイレクトされる
```

### E2E テストの実行

```bash
# テストを実行（AUTH_SECRET は playwright.config.ts の dotenv.config() が .env.local から自動で読み込む）
npm run test:e2e

# 特定のスペックのみ実行
npx playwright test logout.spec.ts
```

---

## 5. 実装チェックリスト

- [x] `app/(protected)/page.tsx` を作成（`app/page.tsx` の内容を移動）
- [x] `app/page.tsx` を削除
- [x] `app/(protected)/_components/Header.tsx` を作成
- [x] `app/(protected)/layout.tsx` を作成
- [x] `next.config.ts` に Google CDN の `remotePatterns` を追加
- [x] `e2e/fixtures/auth-file.ts` を作成
- [x] `e2e/fixtures/auth.setup.ts` を作成
- [x] `e2e/fixtures/.auth/` を `.gitignore` に追加
- [x] `playwright.config.ts` に `setup` プロジェクトを追加
- [x] `e2e/logout.spec.ts` を作成
- [x] 手動でログアウト → `/login` リダイレクトを確認
- [x] E2E テストがグリーン
