# frontend-ci.yml 解説

対象ファイル: `.github/workflows/frontend-ci.yml`

---

## 1. GitHub Actions とは

**GitHub Actions** は GitHub に組み込まれた自動化ツールです。「PR を出したとき」「main にマージしたとき」などのタイミングで、あらかじめ決めておいた処理（テスト・ビルド・デプロイなど）を自動で実行してくれます。

この仕組みを **CI（Continuous Integration / 継続的インテグレーション）** と呼びます。

| CI がない場合 | CI がある場合 |
|-------------|-------------|
| 手動でテストを実行し忘れる | PR を出すと自動でテストが走る |
| 「自分の環境では動いた」問題が起きる | 統一された環境で毎回検証される |
| バグ混入に気づくのが遅れる | マージ前に問題を検出できる |

`.github/workflows/` ディレクトリに置いた YAML ファイルが、GitHub Actions のワークフロー設定ファイルです。

---

## 2. 設定ファイル全体

```yaml
name: Frontend CI

on:
  push:
    branches: [main]
    paths:
      - "frontend/**"
      - ".github/workflows/frontend-ci.yml"
  pull_request:
    branches: [main]
    paths:
      - "frontend/**"
      - ".github/workflows/frontend-ci.yml"

defaults:
  run:
    working-directory: frontend

jobs:
  lint-and-build:
    name: Lint & build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: "lts/*"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Build
        run: npm run build

  unit-test:
    name: Unit Tests (Jest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: "lts/*"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test -- --ci

  e2e-test:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: "lts/*"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run Playwright tests
        run: npm run test:e2e
        env:
          CI: true

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 14
```

---

## 3. 全体の構造

このファイルは大きく 4 つのブロックで構成されています。

```
name        → ワークフローの名前
on          → いつ実行するか（トリガー）
defaults    → 全ジョブ共通の設定
jobs        → 実際に行う処理（複数のジョブを並列で実行）
  ├── lint-and-build  → Lint（コード品質チェック）＋ Build（ビルド確認）
  ├── unit-test       → Jest による単体テスト
  └── e2e-test        → Playwright による E2E テスト
```

---

## 4. 各ブロックの解説

### `name` — ワークフローの名前

```yaml
name: Frontend CI
```

GitHub の Actions タブに表示される名前です。複数のワークフローファイルを管理するときに区別するために使います。

---

### `on` — いつ実行するか（トリガー）

```yaml
on:
  push:
    branches: [main]
    paths:
      - "frontend/**"
      - ".github/workflows/frontend-ci.yml"
  pull_request:
    branches: [main]
    paths:
      - "frontend/**"
      - ".github/workflows/frontend-ci.yml"
```

**`push`** と **`pull_request`** の 2 種類のタイミングで実行します。

| キー | 意味 |
|------|------|
| `push` | main ブランチへの直接プッシュ時 |
| `pull_request` | main ブランチへの PR 作成・更新時 |
| `branches: [main]` | main ブランチへの変更だけを対象にする |
| `paths` | 指定したパスのファイルが変更されたときだけ実行する |

**`paths` の効果:**

`frontend/` 以下のファイル、またはこのワークフローファイル自体が変更されたときだけ CI が動きます。たとえばバックエンドだけ変更した PR では、フロントエンド CI はスキップされます。これにより無駄な CI 実行を防げます。

```
frontend/app/page.tsx を変更    → ✅ CI が動く
backend/src/Main.java を変更    → ❌ CI はスキップ
```

---

### `defaults` — 全ジョブ共通の設定

```yaml
defaults:
  run:
    working-directory: frontend
```

`run:` で実行するシェルコマンドのデフォルト作業ディレクトリを `frontend/` に設定しています。これにより各ステップで `cd frontend && npm ci` と書かずに `npm ci` だけで済みます。

> **なぜ必要か:** このリポジトリはルートに `frontend/`・`backend/` が並ぶ**モノレポ**構成です。GitHub Actions は最初リポジトリルートで動き始めるため、`working-directory` を指定しないと `npm ci` が `package.json` を見つけられず失敗します。

---

### `jobs` — 実際に行う処理

3 つのジョブが**並列で**実行されます。それぞれ独立した仮想マシン（Ubuntu）が割り当てられ、同時に動きます。

```
GitHub Actions の実行イメージ:

lint-and-build  ──────────────────────────→ 完了
unit-test       ──────────────→ 完了
e2e-test        ──────────────────────────────→ 完了
                ↑ 3 つが同時にスタート
```

---

#### ジョブ共通の設定項目

```yaml
runs-on: ubuntu-latest
```

ジョブを実行する仮想マシンの OS を指定します。`ubuntu-latest` は GitHub が提供する最新の Ubuntu 環境です。

---

#### ステップ共通パターン

3 つのジョブはいずれも最初に同じ 3 ステップを踏みます。

**ステップ 1 — コードのチェックアウト**

```yaml
- uses: actions/checkout@v6
```

GitHub のリポジトリをこの仮想マシン上にクローンします。これがないとソースコードにアクセスできません。`actions/checkout` は GitHub が公式に提供する**アクション**（再利用可能な処理のまとまり）です。`@v6` はそのバージョンです。

**ステップ 2 — Node.js のセットアップ**

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v6
  with:
    node-version: "lts/*"
    cache: "npm"
    cache-dependency-path: frontend/package-lock.json
```

| 設定 | 意味 |
|------|------|
| `node-version: "lts/*"` | 現時点の LTS（長期サポート）版 Node.js を自動で選んでインストールする |
| `cache: "npm"` | `node_modules` のキャッシュを有効化。2 回目以降の実行でインストール時間を短縮する |
| `cache-dependency-path` | キャッシュの鍵となるロックファイルの場所を指定する。`package-lock.json` が変わったらキャッシュを作り直す |

**ステップ 3 — 依存パッケージのインストール**

```yaml
- name: Install dependencies
  run: npm ci
```

`npm ci` は `package-lock.json` の内容を**厳密に**再現してインストールするコマンドです。`npm install` と違い、ロックファイルを更新しないため CI 環境での再現性が高くなります。

---

#### `lint-and-build` ジョブ — コード品質とビルドの確認

```yaml
- name: Lint
  run: npm run lint

- name: Build
  run: npm run build
```

| ステップ | 目的 |
|---------|------|
| `Lint` | ESLint でコードのスタイルや潜在的な問題を検出する |
| `Build` | Next.js のビルドが成功するか確認する。ビルドエラーは実行時に気づくより早期に検出するほうがよい |

---

#### `unit-test` ジョブ — 単体テスト

```yaml
- name: Run unit tests
  run: npm test -- --ci
```

Jest でユニットテストを実行します。

**`--` セパレーターとは**

`package.json` の `test` スクリプトは `jest` です。`npm test` を実行すると npm が `jest` を呼び出します。

```
npm test         →  jest を実行
npm test --ci    →  "--ci" を npm 自身へのフラグとして解釈（jest には届かない）
npm test -- --ci →  "--" より後ろを jest へのフラグとして渡す → jest --ci と同じ
```

`--` は「ここから先は npm ではなく、呼び出し先のコマンドに渡してください」という区切り記号です。

**`--ci` フラグとは**

Jest のテストには**スナップショットテスト**という種類があります。コンポーネントの出力を最初に記録しておき、2 回目以降の実行で「出力が変わっていないか」を比較する手法です。

```
通常の動作（--ci なし）
  スナップショットがない → 自動で作成して成功扱いにする

--ci ありの動作
  スナップショットがない → テストを失敗させる
```

CI 環境でスナップショットが自動作成されてしまうと、「テストを書いていないのに通過した」という状態が起きます。`--ci` を付けることで「スナップショットは手元で作成してコミットするもの」というルールを強制できます。

このプロジェクトでは現時点でスナップショットテストを書いていないため、直接影響はありません。将来テストを追加するときのための保険として付けています。

---

#### `e2e-test` ジョブ — E2E テスト

```yaml
e2e-test:
  name: E2E Tests (Playwright)
  runs-on: ubuntu-latest
  timeout-minutes: 60
```

`timeout-minutes: 60` はジョブ全体（セットアップ込み）の上限時間です。テストやインストールが何らかの原因でハングしたとき、最大 60 分でジョブを強制終了させます。設定しないと GitHub Actions のデフォルト上限（6 時間）まで CI が詰まり続けます。

```yaml
- name: Install Playwright browsers
  run: npx playwright install chromium --with-deps
```

Playwright が操作するブラウザ（Chromium）を仮想マシンにインストールします。`--with-deps` は Chromium が依存する OS ライブラリも合わせてインストールするオプションです。Firefox や WebKit は使わないため `chromium` のみ指定してダウンロード時間を短縮しています。

```yaml
- name: Run Playwright tests
  run: npm run test:e2e
  env:
    CI: true
```

`CI: true` を環境変数として渡すことで、`playwright.config.ts` 内の次の設定が有効になります。

```ts
forbidOnly: !!process.env.CI,     // .only がついたテストがあればビルドを失敗させる
retries: process.env.CI ? 2 : 0,  // 失敗時に最大 2 回リトライする
reporter: process.env.CI ? 'github' : 'list',  // GitHub 向けの出力形式を使う
globalTimeout: process.env.CI ? 60 * 60 * 1000 : undefined,  // 全テストの上限を 60 分に設定
```

```yaml
- name: Upload Playwright report
  uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}
  with:
    name: playwright-report
    path: frontend/playwright-report/
    retention-days: 14
```

テスト完了後、Playwright が生成した HTML レポートを GitHub にアップロードします。

| 設定 | 意味 |
|------|------|
| `if: ${{ !cancelled() }}` | テストが失敗してもキャンセルされない限りレポートをアップロードする。失敗したときこそレポートが必要なため |
| `retention-days: 14` | 14 日間 GitHub 上に保存する。古くなったレポートは自動削除される |

---

## 5. CI 実行のイメージ

PR を出したときの流れ：

```
PR を作成
  ↓
GitHub Actions が自動起動
  ↓
┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  lint-and-build │  │   unit-test      │  │   e2e-test           │
│  ① checkout     │  │  ① checkout      │  │  ① checkout          │
│  ② setup-node   │  │  ② setup-node    │  │  ② setup-node        │
│  ③ npm ci       │  │  ③ npm ci        │  │  ③ npm ci            │
│  ④ lint         │  │  ④ jest --ci     │  │  ④ playwright install│
│  ⑤ build        │  │                  │  │  ⑤ playwright test   │
└─────────────────┘  └──────────────────┘  │  ⑥ upload report     │
        ↓                    ↓             └──────────────────────┘
      成功/失敗             成功/失敗               成功/失敗
                                ↓
                   全ジョブ成功 → PR にマージ可能
                   いずれか失敗 → マージをブロック
```

---

## 6. まとめ

```
「frontend/ が変更されたとき」
「Lint・ビルド・Jest・Playwright の 3 ジョブを並列で実行し」
「すべて成功しないと main にマージできない」
フロントエンドの CI パイプライン
```