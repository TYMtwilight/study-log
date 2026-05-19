# Issue #8 共通ヘッダーコンポーネント実装手順書

**対象イシュー：** [Phase 1] 共通ヘッダーコンポーネント実装
**関連要件：** CLAUDE.md §3.1 / 画面定義書 §3.1 ヘッダー / テスト仕様書 §13 MOBILE-01
**更新日：** 2026-05-20

---

## 1. 完了条件の確認

| #   | 条件                                                                                                  | 現状                           |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | ロゴ / アプリ名を表示する                                                                             | ✅ 実装済み（Issue #7）        |
| 2   | ナビゲーションリンクを実装する（ダッシュボード・学習ログ一覧・科目管理・CSVダウンロード・バッチ履歴） | ✅ 実装済み（Issue #7）        |
| 3   | ユーザーアイコン・名前を表示する（Auth.js セッションから取得）                                        | ✅ 実装済み（Issue #7）        |
| 4   | ログアウトボタンを実装する                                                                            | ✅ 実装済み（Issue #7）        |
| 5   | モバイル対応（ハンバーガーメニュー等）を行う                                                          | ❌ 未対応（PC でしか表示なし） |
| 6   | 現在のページに対応するナビゲーションをアクティブ状態にする                                            | ❌ 未対応                      |

**本イシューの実装スコープは条件 5・6** のみ。

現状の [Header.tsx](<frontend/app/(protected)/_components/Header.tsx>) は `hidden md:flex` でナビゲーションを PC のみに出しているため、モバイルではログイン中のユーザーが画面遷移できない。アクティブ状態も付いておらず、現在ページがわからない。

---

## 2. 設計方針

### 2.1 Server Component と Client Component の分離

`Header` は `auth()` でセッションを取得する必要があるため **Server Component** で維持する。
しかし「アクティブ状態」「ハンバーガーメニューの開閉」はクライアント側の状態に依存するため、**Client Component** が必要になる。

ベストプラクティス（Next.js 16 公式）：

- **Layout / Header は Server Component に保つ**（セッション取得・データフェッチを行うため）
- **`usePathname` と `useState` を使う部分だけを Client Component に切り出す**

そのため、以下の 2 ファイル構成にする。

| ファイル                                   | 種別             | 役割                                                                                     |
| ------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| `app/(protected)/_components/Header.tsx`   | Server Component | レイアウト・ロゴ・ユーザー情報・ログアウトフォーム・`NavLinks` の配置                    |
| `app/(protected)/_components/NavLinks.tsx` | Client Component | ナビゲーションリンクの描画・`usePathname` によるアクティブ状態・ハンバーガーメニュー制御 |

> **なぜ Header 全体を Client Component にしないか：**
> ログアウトの Server Action（`'use server'`）は Server Component の `<form action={...}>` の中でしか定義できない。Client Component 化すると Server Action を別ファイルに切り出す必要があり、Issue #7 の構造から不必要に逸脱する。最小スコープで完了条件を満たすため、必要な部分だけを Client Component 化する。

### 2.2 アクティブ判定ルール

| パスパターン                   | アクティブにする条件                                                  |
| ------------------------------ | --------------------------------------------------------------------- |
| `/`（ダッシュボード）          | `pathname === '/'`                                                    |
| `/study-logs`（学習ログ）      | `pathname === '/study-logs' \|\| pathname.startsWith('/study-logs/')` |
| `/subjects`（科目管理）        | `pathname === '/subjects' \|\| pathname.startsWith('/subjects/')`     |
| `/reports/monthly`（CSV）      | `pathname.startsWith('/reports/monthly')`                             |
| `/batch-history`（バッチ履歴） | `pathname.startsWith('/batch-history')`                               |

ダッシュボード（`/`）だけは厳密一致にする。`startsWith('/')` は全パスに一致してしまうため。

### 2.3 モバイルメニューの挙動

| 状態            | 表示                                                     |
| --------------- | -------------------------------------------------------- |
| `md` 以上       | ナビゲーションリンクを横並びで表示。ハンバーガーは非表示 |
| `md` 未満（閉） | ハンバーガーアイコンのみ表示。ナビゲーションは非表示     |
| `md` 未満（開） | ハンバーガーアイコンの下にドロワー風にリンクを縦並び表示 |

- 状態は `useState<boolean>` で保持する
- リンクをタップしたらメニューを閉じる（`onClick` で `setOpen(false)`）
- アイコンは既に依存に入っている `react-icons` を使う（`FaBars` / `FaTimes`）
- **ESC キー**でドロワーを閉じる（`useEffect` で `keydown` イベントを購読。`open` が `true` の間だけリスナーを登録する）
- **ドロワー外クリック**でドロワーを閉じる（`useEffect` で `mousedown` イベントを購読。`#mobile-nav` またはハンバーガーボタン内のクリックはスキップ）
- **ルート変更時**にドロワーを閉じる（React 19 の "adjust state during render" パターンで `prevPathname` との差分を検知して `setOpen(false)`。`useEffect` 内で `setState` すると ESLint の `react-hooks/set-state-in-effect` 警告が出るため、レンダリング中に直接更新する）

### 2.4 アクセシビリティ

- ハンバーガーボタンに `aria-label="メニューを開く" / "メニューを閉じる"`、`aria-expanded`、`aria-controls` を付与する
- PC 用 `<nav>` に `aria-label="メインナビゲーション"` を付与する
- モバイル用 `<nav>` に `aria-label="モバイルナビゲーション"` と `id="mobile-nav"` を付与し、`aria-controls` から参照する
- アクティブなリンクに `aria-current="page"` を付与する
- モバイルドロワーは `{open && (...)}` の条件付きレンダリングではなく **`hidden={!open}` で常に DOM に存在させる**。`aria-controls="mobile-nav"` の参照先が常に存在する必要があるため（`hidden` 属性を使うことでアクセシビリティツリーからは除外しつつ DOM には残す）

### 2.5 ハイドレーションと未実装ルートの対策

`NavLinks` は `'use client'` で動作する Client Component で、ブラウザでイベントハンドラを紐付けるために **ハイドレーション** が必要になる。本イシューの実装中、ナビゲーション先のページが未実装だと **ドロワーが開かなくなる** 不具合に遭遇したため、その背景と対策を残す。

#### ハイドレーションとは

サーバーが生成した HTML をブラウザに送り（見た目だけ。`onClick` などは未接続）、その後ブラウザで React が起動して既存の DOM をスキャンしながらイベントハンドラを紐付けていく工程。Server Side Rendering を採用する Next.js では、Client Component の `onClick` などはハイドレーションが完了して初めて発火するようになる。

```
[サーバー]                [ブラウザ]
 ┌────────┐    HTML送信   ┌──────────────┐
 │ Reactで │ ─────────> │ <button>... │  ← 見た目はある
 │ HTML生成│             │              │
 └────────┘    JS送信    │  + React.js  │  ← まだ動かない
              ─────────> │              │
                         │  ↓ ハイドレーション
                         │ onClick 紐付け │  ← ここで動くようになる
                         └──────────────┘
```

#### 起きていた不具合

ナビゲーションリンクから **存在しないルート（404）** に遷移したあとブラウザの戻るで戻ってきたとき、ハンバーガーボタンが反応しなくなる。`onClick` ハンドラ自体が呼ばれない（`console.log` ですら出ない）。

メカニズム：

1. 未実装ルート（例：`/study-logs`）への遷移 → Next.js 組み込みの 404 ページが表示される（`(protected)/layout.tsx` の外で描画される）
2. Header／NavLinks が **アンマウント** される
3. ブラウザ戻る → Next.js が RSC ペイロードキャッシュから **ソフトナビゲーションで `/` を復元**
4. このとき Client Component の **再ハイドレーションが完了せず**、イベントハンドラが死んだままになる

> `(protected)/not-found.tsx` を置いても解決しない。Next.js の仕様上、segment 配下の `not-found.tsx` は `notFound()` 関数が明示的に呼ばれたときのみ発火し、未マッチ URL の 404 には適用されない（ルートの `app/not-found.tsx` か実装済みページしか効かない）。

#### 対策：未実装ページのスタブ化

ナビゲーションのリンク先となる Phase 1 のページが未実装だと上記の挙動を踏みやすい。中身は未実装でも **ルートとしては存在する** 状態にしておくのが安全。リンク先パスに対応する `page.tsx` を「準備中」表示のスタブとして用意し、Header がアンマウントされる経路自体を塞ぐ。

| パス               | スタブファイル                             |
| ------------------ | ------------------------------------------ |
| `/study-logs`      | `app/(protected)/study-logs/page.tsx`      |
| `/subjects`        | `app/(protected)/subjects/page.tsx`        |
| `/reports/monthly` | `app/(protected)/reports/monthly/page.tsx` |
| `/batch-history`   | `app/(protected)/batch-history/page.tsx`   |

---

## 3. 実装ファイル一覧

| 操作         | ファイル                                        | 内容                                                                  |
| ------------ | ----------------------------------------------- | --------------------------------------------------------------------- |
| **新規作成** | `app/(protected)/_components/NavLinks.tsx`      | アクティブ状態 + モバイルメニューを担う Client Component              |
| **更新**     | `app/(protected)/_components/Header.tsx`        | ナビゲーション部分を `NavLinks` に置き換える                          |
| **新規作成** | `app/(protected)/study-logs/page.tsx`           | §2.5 の対策スタブ。中身は「準備中」プレースホルダで OK                |
| **新規作成** | `app/(protected)/subjects/page.tsx`             | §2.5 の対策スタブ                                                     |
| **新規作成** | `app/(protected)/reports/monthly/page.tsx`      | §2.5 の対策スタブ                                                     |
| **新規作成** | `app/(protected)/batch-history/page.tsx`        | §2.5 の対策スタブ                                                     |
| **新規作成** | `app/(protected)/_components/NavLinks.test.tsx` | Jest + Testing Library によるアクティブ状態・メニュー開閉の単体テスト |

E2E テスト（MOBILE-01 相当）は本イシューでは省略可。Issue #7 で構築した E2E 基盤を流用してモバイルビューでメニュー開閉を検証することも可能。

---

## 4. 実装ステップ

### Step 1 — `NavLinks.tsx` の作成

`app/(protected)/_components/NavLinks.tsx` を新規作成する。

```tsx
// app/(protected)/_components/NavLinks.tsx
'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { FaBars, FaTimes } from "react-icons/fa"

type NavItem = {
    href: string
    label: string
    // アクティブ判定関数。階層下のページも含める場合は startsWith を使う
    isActive: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
    { href: '/', label: 'ダッシュボード', isActive: (p) => p === '/' },
    {
        href: '/study-logs',
        label: '学習ログ',
        isActive: (p) => p === '/study-logs' || p.startsWith('/study-logs/'),
    },
    {
        href: '/subjects',
        label: '科目管理',
        isActive: (p) => p === '/subjects' || p.startsWith('/subjects/'),
    },
    {
        href: '/reports/monthly',
        label: 'CSVダウンロード',
        isActive: (p) => p.startsWith('/reports/monthly'),
    },
    {
        href: '/batch-history',
        label: 'バッチ履歴',
        isActive: (p) => p.startsWith('/batch-history'),
    },
]

const linkBase = 'transition-colors hover:text-gray-900'
const linkActive = 'text-gray-900 font-semibold'
const linkInactive = 'text-gray-600'

export default function NavLinks() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    // ルート変更時にドロワーを閉じる（React 19 "adjust state during render" パターン）
    const [prevPathname, setPrevPathname] = useState(pathname)
    if (pathname !== prevPathname) {
        setPrevPathname(pathname)
        setOpen(false)
    }

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open])

    useEffect(() => {
        if (!open) return
        const onClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (target.closest('#mobile-nav') || target.closest('button[aria-controls="mobile-nav"]')) {
                return
            }
            setOpen(false)
        }
        document.addEventListener('mousedown', onClickOutside)
        return () => document.removeEventListener('mousedown', onClickOutside)
    }, [open])

    const renderLink = (item: NavItem, onClick?: () => void) => {
        const active = item.isActive(pathname)
        return (
            <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onClick}
                className={`${linkBase} ${active ? linkActive : linkInactive}`}
            >
                {item.label}
            </Link>
        )
    }

    return (
        <>
            {/* PC 用: 横並びナビゲーション */}
            <nav
                aria-label="メインナビゲーション"
                className="hidden md:flex items-center gap-6 text-sm"
            >
                {NAV_ITEMS.map((item) => renderLink(item))}
            </nav>

            {/* モバイル用: ハンバーガーボタン */}
            <button
                type="button"
                aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
                aria-expanded={open}
                aria-controls="mobile-nav"
                onClick={() => setOpen((prev) => !prev)}
                className="md:hidden inline-flex items-center justify-center rounded-full p-2 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
                {open ? <FaTimes className="h-5 w-5" /> : <FaBars className="h-5 w-5" />}
            </button>

            {/* モバイル用: ドロワー（hidden 属性で常に DOM に存在させる） */}
            <nav
                id="mobile-nav"
                aria-label="モバイルナビゲーション"
                hidden={!open}
                className="absolute left-0 right-0 top-full md:hidden
                    flex flex-col gap-1 border-b bg-white px-6 py-3 text-sm shadow-sm"
            >
                {NAV_ITEMS.map((item) =>
                    renderLink(item, () => setOpen(false)),
                )}
            </nav>
        </>
    )
}
```

**ポイント：**

- `'use client'` を先頭に書く（`usePathname` / `useState` / `useEffect` は Client Component 専用）
- `NAV_ITEMS` をモジュールトップに置いて再レンダリングごとに再生成しないようにする
- アクティブ判定はリンクごとに関数で持つ。`/` のような厳密一致と、子パスを含む `startsWith` 判定を 1 箇所で表現できる
- アクセシビリティ：`aria-current="page"` / `aria-expanded` / `aria-controls` を付与。PC・モバイル両 `<nav>` に `aria-label` を付与
- ドロワーは `{open && (...)}` の条件付きレンダリングではなく `hidden={!open}` を使う（`aria-controls` の参照先が常に DOM に存在する必要があるため）
- ルート変更・ESC・ドロワー外クリックのクローズ処理を `useEffect` と prevPathname パターンで実装
- モバイルドロワーの位置決めは `absolute left-0 right-0 top-full` で Header 直下に出す。Header 側は `relative` を付ける（次ステップ）

---

### Step 2 — `Header.tsx` の更新

既存のナビゲーション部分を `NavLinks` に置き換える。`relative` クラスを追加してドロワーの `absolute` 配置の基準にする。

```tsx
// app/(protected)/_components/Header.tsx
import Image from "next/image";
import Link from "next/link";

import NavLinks from "./NavLinks";

import { auth, signOut } from "@/auth";

export default async function Header() {
  const session = await auth();

  return (
    <header
      className="relative flex items-center justify-between gap-4
        px-6 py-3 border-b bg-white shadow-sm"
    >
      <Link href="/" className="text-lg font-bold text-gray-900">
        STUDY LOG
      </Link>

      <NavLinks />

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
        <span className="hidden sm:inline text-sm text-gray-700">
          {session?.user?.name}
        </span>

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

**変更点：**

| 箇所                         | 変更内容                                                             |
| ---------------------------- | -------------------------------------------------------------------- |
| `<header>` のクラス          | `relative` と `gap-4` を追加（モバイルドロワーの基準点・要素間余白） |
| 旧 `<nav>` ブロック          | `<NavLinks />` に置き換え                                            |
| ユーザー名 `<span>` のクラス | `hidden sm:inline` を追加（モバイルで横幅を節約。アイコンは残す）    |

ロゴ・ユーザー情報・ログアウトボタンは Server Component のままなので、ログアウトの Server Action もそのまま動く。

---

### Step 3 — リンク先ページのスタブを作成

§2.5 のとおり、ナビゲーションのリンク先パスが未実装のままだと、404 → 戻る操作でハイドレーションが壊れドロワーが動かなくなる。Phase 1 で実装予定のページに対応する `page.tsx` を「準備中」表示のスタブとして 4 つ作成し、ルートとしては存在する状態にしておく。

```tsx
// app/(protected)/study-logs/page.tsx
export default function StudyLogsPage() {
  return <div>学習ログ（準備中）</div>;
}
```

```tsx
// app/(protected)/subjects/page.tsx
export default function SubjectsPage() {
  return <div>科目管理（準備中）</div>;
}
```

```tsx
// app/(protected)/reports/monthly/page.tsx
export default function MonthlyReportPage() {
  return <div>CSVダウンロード（準備中）</div>;
}
```

```tsx
// app/(protected)/batch-history/page.tsx
export default function BatchHistoryPage() {
  return <div>バッチ履歴（準備中）</div>;
}
```

各ページは後続のフェーズで本実装に置き換える。今は **ルートを存在させること** が目的。

---

### Step 4 — 単体テスト（任意だが推奨）

`NavLinks` は分岐ロジックを持つため Jest + Testing Library で検証する。

#### 4-1. `app/(protected)/_components/NavLinks.test.tsx`

```tsx
// app/(protected)/_components/NavLinks.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import NavLinks from './NavLinks'

// usePathname のモック
const mockPathname = jest.fn<string, []>()
jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname(),
}))

describe('NavLinks', () => {
    beforeEach(() => {
        mockPathname.mockReset()
    })

    test('現在のパスに対応するリンクに aria-current="page"が付与される', () => {
        mockPathname.mockReturnValue('/study-logs')
        render(<NavLinks />)

        const activeLinks = screen.getAllByRole('link', { name: '学習ログ' })
        // PC 用 nav とモバイル用 nav 両方にレンダリングされるため getAllByRole で確認
        expect(activeLinks[0]).toHaveAttribute('aria-current', 'page')

        const inactiveLinks = screen.getAllByRole('link', { name: 'ダッシュボード' })
        expect(inactiveLinks[0]).not.toHaveAttribute('aria-current')
    })

    test('子パスでも親リンクがアクティブになる', () => {
        mockPathname.mockReturnValue('/study-logs/new')
        render(<NavLinks />)

        const activeLinks = screen.getAllByRole('link', { name: '学習ログ' })
        expect(activeLinks[0]).toHaveAttribute('aria-current', 'page')
    })

    test('ダッシュボードは厳密一致のみアクティブ', () => {
        mockPathname.mockReturnValue('/study-logs')
        render(<NavLinks />)

        const dashboardLinks = screen.getAllByRole('link', { name: 'ダッシュボード' })
        expect(dashboardLinks[0]).not.toHaveAttribute('aria-current')
    })

    test('ハンバーガーボタンを押すとモバイルナビが開閉する', async () => {
        const user = userEvent.setup()
        mockPathname.mockReturnValue('/')
        render(<NavLinks />)

        // 初期状態: モバイルナビは閉じている
        const toggle = screen.getByRole('button', { name: 'メニューを開く' })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')

        // 開く
        await user.click(toggle)
        expect(screen.getByRole('button', { name: 'メニューを閉じる' })).toHaveAttribute(
            'aria-expanded',
            'true',
        )

        // 閉じる
        await user.click(screen.getByRole('button', { name: 'メニューを閉じる' }))
        expect(screen.getByRole('button', { name: 'メニューを開く' })).toHaveAttribute(
            'aria-expanded',
            'false',
        )
    })

    test('ESCキーでドロワーが閉じる', async () => {
        const user = userEvent.setup()
        mockPathname.mockReturnValue('/')
        render(<NavLinks />)

        await user.click(screen.getByRole('button', { name: 'メニューを開く' }))
        expect(screen.getByRole('button', { name: 'メニューを閉じる' })).toBeInTheDocument()

        await user.keyboard('{Escape}')
        expect(screen.getByRole('button', { name: 'メニューを開く' })).toBeInTheDocument()
    })

    test('ルート変更時にドロワーが閉じる', async () => {
        const user = userEvent.setup()
        mockPathname.mockReturnValue('/')
        // render() の戻り値から再レンダリング関数（rerender）を取り出す
        const { rerender } = render(<NavLinks />)

        await user.click(screen.getByRole('button', { name: 'メニューを開く' }))
        expect(screen.getByRole('button', { name: 'メニューを閉じる' })).toBeInTheDocument()

        // パスを変えて再レンダリング → prevPathname パターンでドロワーが閉じる
        mockPathname.mockReturnValue('/study-logs')
        rerender(<NavLinks />)
        expect(screen.getByRole('button', { name: 'メニューを開く' })).toBeInTheDocument()
    })
})
```

> `@testing-library/user-event` が `package.json` に未追加なら `npm install --save-dev @testing-library/user-event` を実行する。既に追加済みであれば不要。

---

## 5. 動作確認手順

### 5.1 ローカルでの手動確認

```bash
npm run dev
```

| #   | 操作                                                              | 期待結果                                                          |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `/` を開く                                                        | 「ダッシュボード」リンクが太字 + 濃いグレーで表示される           |
| 2   | 「学習ログ」をクリック                                            | スタブ「学習ログ（準備中）」が表示され、リンクが太字になる        |
| 3   | DevTools でビューポートを 375px に切り替え                        | ナビゲーションが消え、ハンバーガーアイコンが表示される            |
| 4   | ハンバーガーアイコンをクリック                                    | ヘッダー直下にリンクが縦並びで表示される（アイコンが × に変わる） |
| 5   | リンクをクリック                                                  | メニューが閉じ、対象ページへ遷移する                              |
| 6   | 任意のリンクで遷移 → ブラウザ戻る → ハンバーガーを開く            | §2.5 の再現確認。スタブを作っていればドロワーが正常に開く         |
| 7   | キーボードで Tab → Enter で操作                                   | ハンバーガーがフォーカス可能で、Enter で開閉できる                |
| 8   | スクリーンリーダー（または DevTools の Accessibility パネル）確認 | `aria-current="page"` / `aria-expanded` が正しく反映されている    |

### 5.2 自動テスト

```bash
# 単体テスト
npm test -- NavLinks

# 既存テスト全体の回帰確認
npm test
```

---

## 6. 実装チェックリスト

- [x] `app/(protected)/_components/NavLinks.tsx` を新規作成
- [x] `app/(protected)/_components/Header.tsx` を更新（`NavLinks` を組み込み、`relative` を付与）
- [x] §2.5 のスタブ 4 ファイルを新規作成（`study-logs` / `subjects` / `reports/monthly` / `batch-history`）
- [x] PC ビューでアクティブ状態が正しく反映される
- [x] モバイルビューでハンバーガーメニューが開閉する
- [x] ナビゲーション遷移 → ブラウザ戻るの後でもハンバーガーが反応する（§2.5 の再現確認）
- [x] アクティブリンクに `aria-current="page"` が付く
- [x] ハンバーガーボタンに `aria-label` / `aria-expanded` / `aria-controls` が付く
- [ ] `NavLinks.test.tsx` を新規作成しグリーン（任意）
- [ ] 既存の E2E（`logout.spec.ts`）がリグレッションなくグリーン

---

## 7. 参考

- 画面定義書 §3.1 ヘッダー
- Next.js 16 公式：[usePathname](https://nextjs.org/docs/app/api-reference/functions/use-pathname) — Server Component の Layout に Client な NavLinks を埋め込むパターン
- Issue #7 実装手順書 [doc/impl/issue-7-logout.md](doc/impl/issue-7-logout.md) — Header の Server Component 構造の前提
