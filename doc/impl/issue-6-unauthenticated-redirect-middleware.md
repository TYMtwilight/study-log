# Issue #6 実装手順書 — 未認証リダイレクトミドルウェア

**対象イシュー：** [Phase 1] 未認証リダイレクトミドルウェア実装  
**作成日：** 2026-05-15

---

## 1. 現状確認

以下のファイルは **Issue #5（Google OAuthログイン）** の際に作成済みだが、一部が古い書き方になっている。

| ファイル                             | 状態                  | 内容                                                                   |
| ------------------------------------ | --------------------- | ---------------------------------------------------------------------- |
| `frontend/middleware.ts`             | ⚠️ **非推奨の書き方** | `auth as middleware` をエクスポート（Next.js 16+ では不可）            |
| `frontend/auth.ts`                   | ⚠️ 一部修正必要       | `authorized` コールバックで `!!auth` を返す。`/login` の明示的除外なし |
| `frontend/app/(auth)/login/page.tsx` | ✅ 実装済み           | ログイン済みユーザーを `/` へリダイレクト                              |

---

## 2. 残作業と完了条件の対応

| 完了条件                                     | 状態                      | 対応内容                                    |
| -------------------------------------------- | ------------------------- | ------------------------------------------- |
| 未認証ユーザーを `/login` へリダイレクト     | ⚠️ 要修正                 | `middleware.ts` を `proxy.ts` に移行する    |
| `/login` 自体はリダイレクト対象から除外      | ⚠️ 要修正                 | `authorized` コールバックで明示的に除外する |
| ログイン済みで `/login` → `/` へリダイレクト | ✅ 実装済み（page.tsx）   | 変更不要                                    |
| API ルートも検証対象とする                   | ✅ matcher が対象に含める | 変更不要（補足は §4 参照）                  |

残作業は **3 点**：

1. `frontend/middleware.ts` を `frontend/proxy.ts` に移行（Next.js 16+ 対応）
2. `auth.ts` の `authorized` コールバックで `/login` を明示的に除外する
3. E2E テストを追加する（AUTH-04、E2E-LOGIN-03）

---

## 3. 実装手順

### 3.1 `middleware.ts` → `proxy.ts` への移行

Next.js 16 以降、Auth.js v5 は `middleware.ts` の代わりに **`proxy.ts`** を使用する。  
（Auth.js 公式ドキュメント：[Protecting Routes](https://authjs.dev/getting-started/session-management/protecting)）

**手順：**

1. `frontend/middleware.ts` を削除する
2. `frontend/proxy.ts` を新規作成する

**`frontend/proxy.ts`（新規作成）：**

```ts
export { auth as proxy } from "@/auth";

export const config = {
  /*
   * 以下を除くすべてのパスに適用する:
   * - api/auth（Auth.js のエンドポイント）
   * - _next/static, _next/image
   * - favicon.ico
   */
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

---

### 3.2 `auth.ts` — `authorized` コールバックの修正

`/login` を明示的に除外することで、無限リダイレクトを防ぐ意図をコード上に示す。

**変更前：**

```ts
authorized({ auth }) {
  return !!auth
},
```

**変更後：**

```ts
authorized({ auth, request }) {
  // /login は未認証でもアクセスを許可する（リダイレクトループ防止）
  if (request.nextUrl.pathname === '/login') return true
  return !!auth
},
```

**ポイント：**

- Auth.js v5 は `pages.signIn` に設定したパスへの無限リダイレクトを内部的に防ぐが、
  明示的に除外することでコードの意図を明確にする。
- `request` は `NextRequest` 型であり、`nextUrl.pathname` でパスを取得できる。

---

### 3.3 E2E テストの追加

ファイル：`frontend/e2e/proxy.spec.ts`（新規作成）

```ts
import { test, expect } from "@playwright/test";

/**
 * AUTH-04: 未認証時にログイン画面へリダイレクト
 * E2E-LOGIN-03: ログイン済みユーザーが /login へアクセスすると / へリダイレクト
 *
 * NOTE: Playwright の storageState を使い、
 *   - 未認証状態: デフォルト（セッションなし）
 *   - 認証済み状態: e2e/fixtures/auth.setup.ts で生成した storageState を使用
 */

test.describe("未認証リダイレクト（AUTH-04）", () => {
  test("未ログイン状態で / にアクセスすると /login へリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("未ログイン状態で /study-logs にアクセスすると /login へリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/study-logs");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("ログイン済みユーザーの /login アクセス（E2E-LOGIN-03）", () => {
  // E2E テストで「ログイン済み状態」を作るには、Google の本物の認証を通らずに
  // セッションを偽装する仕組みが必要。その仕組みがまだ未整備のため skip にしている。
  test("ログイン済みユーザーが /login へアクセスすると / へリダイレクトされる", () => {
    test.skip(true, "OAuth Mock が整い次第実装する");
  });
});
```

> **`test.todo` を使わない理由**  
> Playwright 1.59.1 の型定義に `test.todo` が存在しないため、`test.skip(true, ...)` で代替している。

---

## 4. matcher の補足（API ルート保護）

`proxy.ts` の matcher：

```ts
matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
```

- `api/auth` は Auth.js のエンドポイントなので **除外**（必須）
- それ以外のパス（`/api/study-logs` 等の将来的な Next.js API Route）は **保護対象に含まれる**
- 現状、Next.js 側の API Route は `app/api/auth` のみのため、追加対応は不要

> Spring Boot の REST API（`http://localhost:8080`）は別サーバーであり、このプロキシの対象外。  
> Spring Boot 側の認証は Phase 2 で JWT 検証として実装する。

---

## 5. 動作確認手順

1. **開発サーバー起動**

   ```bash
   cd frontend
   npm run dev
   ```

2. **未認証リダイレクトの確認**
   - シークレットウィンドウ（または別ブラウザ）で `http://localhost:3000/` にアクセス
   - `http://localhost:3000/login` へリダイレクトされることを確認

3. **`/login` が無限リダイレクトしないことの確認**
   - シークレットウィンドウで `http://localhost:3000/login` に直接アクセス
   - ログインページが正常に表示され、リダイレクトループが起きないことを確認

4. **ログイン済みユーザーの確認**
   - Google アカウントでログイン後、`http://localhost:3000/login` に直接アクセス
   - `http://localhost:3000/` へリダイレクトされることを確認

5. **E2E テスト実行**

   ```bash
   cd frontend
   npx playwright test e2e/proxy.spec.ts
   ```

---

## 6. 実装完了チェックリスト

- [x] `frontend/middleware.ts` を削除する
- [x] `frontend/proxy.ts` を作成する（`auth as proxy` をエクスポート）
- [x] `auth.ts` の `authorized` コールバックに `/login` の明示的除外を追加する
- [x] `e2e/proxy.spec.ts` を作成し、未認証リダイレクトの E2E テストを追加する
- [x] 開発サーバーで §5 の手動確認を完了する
- [x] `npx playwright test e2e/proxy.spec.ts` がパスすることを確認する
