# Playwright 設定ファイル解説

対象ファイル: `frontend/playwright.config.ts`

---

## 1. E2E テストとは

**E2E テスト（End to End テスト）** は、ユーザーが実際に操作する流れをそのまま自動でテストする手法です。

### 他のテストとの違い

| テスト種別 | 何をテストするか | 例 |
|-----------|----------------|-----|
| **単体テスト** | 関数 1 つの動作 | `calcTotal(120)` が `120` を返すか |
| **統合テスト** | 複数モジュールの連携 | API が DB から正しく値を取ってくるか |
| **E2E テスト** | ユーザー操作の流れ全体 | ブラウザでログインして、ログを登録して、一覧に表示されるか |

### このプロジェクトでの例

```
1. ブラウザで http://localhost:3000 を開く
2. Google ログインボタンをクリック
3. ダッシュボードにリダイレクトされることを確認
4. 「新規ログ登録」を押して学習ログを入力・保存
5. 一覧ページに登録したログが表示されることを確認
```

こういった一連の流れを、Playwright が**本物のブラウザを操作して自動で確認**してくれます。

### メリット・デメリット

**メリット**
- ユーザー視点での動作確認ができる
- フロント・API・DB が全部繋がった状態でテストできる

**デメリット**
- 実行が遅い（ブラウザを実際に動かすため）
- 環境（サーバー起動など）の準備が必要

---

## 2. Playwright とは

ブラウザを自動操作して E2E テストを行うツールです。  
例えば「ログインページを開いて、ボタンをクリックして、ダッシュボードに遷移するか確認する」といった操作を自動でやってくれます。

`playwright.config.ts` は「どのブラウザで」「どこの URL で」「何秒まで待つか」などのルールを定義するファイルです。

---

## 3. 設定ファイル全体

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  globalTimeout: process.env.CI ? 60 * 60 * 1000 : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
```

---

## 4. 各設定の解説

### インポート

```ts
import { defineConfig, devices } from '@playwright/test'
```

- `defineConfig` — 設定を定義するための関数
- `devices` — 「Desktop Chrome」「iPhone 14」などの端末プリセット集。端末ごとに異なる画面サイズ・User Agent・ピクセル密度などの設定をまとめたオブジェクトで、例えば `devices['iPhone 14']` を指定すると実機に近い環境でテストできる

> **User Agent とは**  
> ブラウザがサーバーに「自分が何者か」を伝えるための文字列。Chrome からアクセスすると `Mozilla/5.0 ... Chrome/124.0.0.0 ...`、iPhone Safari からアクセスすると `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 ...) ... Mobile/15E148 ...` のような文字列が送られる。サーバーはこれを見てスマホ向け・PC 向けのレイアウトを出し分けたり、ボットを検出したりする。`devices['iPhone 14']` を指定すると Playwright が iPhone の User Agent をサーバーに送信するため、実機と同じレスポンスが返ってきてテストできる。

---

### testDir — テストファイルの場所

```ts
testDir: './e2e',
```

`e2e` フォルダ内のファイルをテスト対象とする宣言です。  
`e2e` は **End to End** の略で、ユーザーが実際に操作する流れ全体をテストする手法のことです。

`e2e/` というディレクトリ名は慣習的によく使われますが、絶対的な標準ではなくプロジェクトによって異なります。

| ディレクトリ名 | 使われるケース |
|---|---|
| `e2e/` | Playwright の公式ドキュメントでもよく使われる。最もポピュラー |
| `tests/` | Playwright のデフォルト設定値 |
| `cypress/` | Cypress（別の E2E テストツール）の慣習 |
| `__tests__/` | Jest（単体テスト）でよく使われる |

Playwright で `npx playwright init` を実行するとデフォルトは `tests/` になりますが、`e2e/` に変えているプロジェクトも多く、どちらも一般的です。

---

### timeout — タイムアウト

```ts
timeout: 30_000,
```

1 つのテストが **30 秒以内に終わらなかったら失敗**とみなします。  
`30_000` は `30000`（ミリ秒 = 30 秒）と同じ意味です。数字を読みやすくするためにアンダースコアで区切れます。

---

### globalTimeout — テストスイート全体のタイムアウト

```ts
globalTimeout: process.env.CI ? 60 * 60 * 1000 : undefined,
```

テストスイート**全体**の最大実行時間を指定します。`timeout` が「1 テストあたり」の上限なのに対し、`globalTimeout` は「全テスト合計」の上限です。

| 実行場所 | 値 | 意味 |
|---|---|---|
| ローカル | `undefined` | 制限なし |
| CI | `60 * 60 * 1000`（= 3,600,000 ms = 1 時間） | 1 時間で強制終了 |

CI でサーバー起動などのセットアップが壊れた場合、`globalTimeout` がないとジョブが無制限に待ち続けてしまいます。上限を設けることで、異常な状態を早期に検出できます。

> **`60 * 60 * 1000` の読み方**  
> 時間をミリ秒に換算する計算式です。`60`（秒）× `60`（分）× `1000`（ミリ秒）= 1 時間。`3_600_000` と直接書くより意図が伝わりやすいため、この形式が使われます。

---

### fullyParallel — テストケース単位の並列実行

```ts
fullyParallel: true,
```

デフォルトではファイル単位で並列実行されますが、`true` にするとテストケース（`test(...)` 1 つ1つ）単位で並列実行されます。テスト全体の実行時間を短縮できます。

---

### forbidOnly — `test.only` の誤コミット防止

```ts
forbidOnly: !!process.env.CI,
```

**`test.only` とは何か**

Playwright には、特定のテストだけを実行したいときに使う `test.only` という記法があります。

```ts
test.only('このテストだけ実行される', async ({ page }) => { ... })
test('このテストはスキップされる', async ({ page }) => { ... })
```

ローカルでデバッグ中に一時的に使うものですが、**うっかりそのままコミットしてしまうと、CI では `test.only` のついたテスト以外が全部スキップされてしまいます**。他のテストが壊れていても気づけない状態になります。

`forbidOnly: !!process.env.CI` を設定すると、CI 上で `test.only` が残っているとエラーになってテストが実行されないため、誤コミットをその場で検出できます。ローカルでは通常通り `test.only` が使えます。

**`!!process.env.CI` の意味**

`!` を 1 回つけると真偽値が反転します。2 回つけると元に戻りつつ、`undefined` のような「値がない」状態を確実に `false` に変換できます。

```
// ローカル（CI 環境変数なし）
process.env.CI  → undefined
!undefined      → true   （反転）
!!undefined     → false  （さらに反転 → false に確定）

// GitHub Actions（CI=true がセットされる）
process.env.CI  → 'true'
!'true'         → false  （反転）
!!'true'        → true   （さらに反転 → true に確定）
```

---

### retries — テスト失敗時のリトライ回数

```ts
retries: process.env.CI ? 2 : 0,
```

テストが失敗したときに自動で再実行する回数です。

| 実行場所 | リトライ回数 |
|---------|------------|
| ローカル | 0（即失敗） |
| CI | 2回（最大3回実行） |

CI ではネットワークの瞬断など一時的な要因でテストが落ちることがあるため、リトライを設定しておくことで不安定なテスト結果を減らせます。また、`trace: 'on-first-retry'` が有効になるのもリトライが発生したときのため、**この設定がないとトレースが一切記録されません**。

---

### reporter — テスト結果の表示形式

```ts
reporter: process.env.CI ? 'github' : 'list',
```

`process.env.CI` は「CI（GitHub Actions など自動テスト環境）で実行中か？」を判定する環境変数です。

| 実行場所 | 表示形式 |
|---------|---------|
| ローカル（自分の PC） | `list`：シンプルなテキスト一覧 |
| CI（GitHub Actions） | `github`：GitHub 専用の見やすい形式 |

切り替えは自動で行われますが、仕組みは次の通りです。**`CI=true` をセットするのは Playwright ではなく GitHub Actions 側**で、GitHub Actions はジョブ実行時にこの環境変数を自動で用意する仕様になっています。Playwright はその値を読み取って判定しているだけです。

```
// ローカル実行時
process.env.CI → undefined（セットされていない）
undefined ? 'github' : 'list' → 'list'

// GitHub Actions 実行時
GitHub Actions が自動で CI=true をセット
process.env.CI → 'true'
'true' ? 'github' : 'list' → 'github'
```

なお、ローカルから `CI=true npx playwright test` と実行すれば `github` 形式にすることもできます。

---

### use — 全テスト共通設定

```ts
use: {
  baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  trace: 'on-first-retry',
},
```

- **`baseURL`**: テスト内で `page.goto('/login')` と書いたとき、`http://localhost:3000/login` に自動補完されます。`??` は「左が未定義なら右を使う」という演算子です。
- **`trace`**: テストが失敗してリトライしたときだけ、操作の全記録（クリック・スクリーンショット等）を保存します。失敗原因の調査に使います。

---

### projects — テスト対象ブラウザ

```ts
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
],
```

Chrome（Chromium）のデスクトップ版でテストします。  
`...devices['Desktop Chrome']` は「Chrome デスクトップ向けの画面サイズ・UA などの設定一式を展開する」という意味です。Firefox や Safari を追加したい場合はここにプロジェクトを増やします。

`projects` 配列にオブジェクトを追加するだけで複数ブラウザに対応できます。

```ts
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  // Firefox を追加
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  // Safari を追加
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
  // スマホ（iPhone）を追加
  {
    name: 'mobile-chrome',
    use: { ...devices['iPhone 14'] },
  },
],
```

追加すると**同じテストが全ブラウザで並列実行**され、「Chrome では動くのに Safari では崩れる」といった問題を自動で検出できます。ただし実行時間が増えるため、個人開発では Chrome のみに絞るのが一般的です。

---

### webServer — テスト前のサーバー自動起動

```ts
webServer: {
  command: 'npm run build && npm run start',
  url: 'http://localhost:3000',
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  stdout: 'ignore',
  stderr: 'pipe',
},
```

テスト実行前に Next.js サーバーを自動起動します。

| 設定 | 意味 |
|-----|-----|
| `command` | ビルド → 起動の順で実行するコマンド |
| `url` | この URL が応答するまで待ってからテスト開始 |
| `reuseExistingServer` | ローカルでは起動済みのサーバーを使い回す。CI では必ず新規起動 |
| `timeout` | サーバー起動の待ち上限（120 秒） |
| `stdout` | サーバーの標準出力を無視する（`'ignore'` がデフォルト） |
| `stderr` | サーバーのエラー出力をそのまま表示する（CI でのデバッグに使う） |

`stderr: 'pipe'` を設定しておくと、CI でサーバーが起動失敗したときにエラーログが確認できます。デフォルト値と同じですが、意図を明示するために書いています。

---

## 5. `npm run dev` ではなく `npm run build && npm run start` を使う理由

### 両者の違い

| | `npm run dev` | `npm run build && npm run start` |
|---|---|---|
| モード | 開発モード | 本番モード |
| 起動速度 | 速い | ビルドに時間がかかる |
| 最適化 | なし（デバッグ重視） | あり（minify・Tree Shaking 等） |
| 動作 | ファイル変更を即反映 | ビルド成果物を実行 |

### 本番モードを使う理由

**「実際にユーザーが使う環境」と同じ状態でテストするため**です。

開発モードには本番と異なる挙動が含まれることがあります。

- エラーハンドリングの差異
- パフォーマンス特性の違い
- 一部の最適化が無効になっている

開発モードでテストが通っても本番で壊れる、という事態を防ぐために本番ビルドでテストします。

### ローカル開発での救済措置

毎回ビルドするのは時間がかかって不便なため、次の設定があります。

```ts
reuseExistingServer: !process.env.CI,  // ローカルでは true
```

ローカルでは**起動済みのサーバーを使い回せる**ので、別ターミナルで `npm run dev` を起動しておけばビルドをスキップできます。

---

## 6. まとめ

```
「e2e フォルダにあるテストを」
「Chrome で」
「localhost:3000 に対して」
「必要ならサーバーを自動起動してから」
「実行する」
```
