# GitHub Actions CI パイプライン設定 実装手順

**対応 Issue:** [#34 \[インフラ\] GitHub Actions CI パイプライン設定](https://github.com/TYMtwilight/study-log/issues/34)  
**作成日:** 2026年5月4日  
**前提 Issue:** #2 Spring Boot 初期セットアップ、#4 Flyway マイグレーション設定

---

## 概要

PR・main ブランチ push 時に自動でテストを実行する CI パイプラインを構築する。

| ワークフローファイル                | 対象                   | 主なステップ                               |
| ----------------------------------- | ---------------------- | ------------------------------------------ |
| `.github/workflows/frontend-ci.yml` | `frontend/` 以下の変更 | lint / build / Jest / Playwright E2E       |
| `.github/workflows/backend-ci.yml`  | `backend/` 以下の変更  | JUnit + TestContainers / SpotBugs 静的解析 |

---

## Step 1 — フロントエンド: テストフレームワーク追加

### 1-1. Jest + React Testing Library

`frontend/` ディレクトリで依存関係を追加する。

```bash
cd frontend
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom \
  @testing-library/dom @types/jest ts-node
```

> `babel-jest` / `@babel/core` 等の Babel 関連パッケージは不要。`next/jest` が内蔵の SWC コンパイラでトランスパイルを行うため、パッケージを追加しなくてよい。

`frontend/jest.config.ts` を作成する。

```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.test.{ts,tsx}'],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', '!app/**/*.d.ts'],
}

export default createJestConfig(config)
```

`next/jest` を使うことで以下が自動設定される。

| 項目 | 内容 |
| --- | --- |
| トランスパイル | SWC（Babel より高速） |
| CSS / 画像 / フォントのモック | `.css`, `.module.css`, `next/font` 等を自動でスタブ化 |
| 環境変数 | `.env` / `.env.local` 等を自動でロード |
| 除外パス | `node_modules/` と `.next/` を自動でテスト対象外に設定 |
| `transform` 手動設定 | 不要（自動設定されるため削除） |

> **SWC コンパイラについて**
>
> SWC（Speedy Web Compiler）は Rust 製の JavaScript / TypeScript コンパイラ。Next.js 12 から Babel の代替として採用され、デフォルトで有効になっている。
>
> | 比較項目 | Babel | SWC |
> | --- | --- | --- |
> | 実装言語 | JavaScript | Rust |
> | ファイル単位のコンパイル速度 | 基準 | **最大 17 倍高速** |
> | Fast Refresh（開発時の差分更新） | 基準 | **最大 5 倍高速** |
> | 設定ファイル | `babel.config.js` / `.babelrc` | `next.config.ts`（`experimental.swcPlugins`）|
>
> **Babel へのフォールバック:** プロジェクトルートに `babel.config.js` / `.babelrc` が存在する場合、Next.js は自動的に SWC を無効化して Babel にフォールバックする。本プロジェクトでは Babel 設定ファイルを置かないことで SWC が使われ続ける。

`frontend/jest.setup.ts` を作成する。

```ts
import '@testing-library/jest-dom'
```

### 1-2. Playwright

```bash
cd frontend
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

`frontend/playwright.config.ts` を作成する。

```ts
import { defineConfig, devices } from "@playwright/test";

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

E2E テスト用ディレクトリを作成しておく。

```
frontend/
└── e2e/
    └── .gitkeep
```

### 1-3. package.json にスクリプト追加

`frontend/package.json` の `"scripts"` に以下を追記する。

```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test"
  }
}
```

---

## Step 2 — バックエンド: TestContainers セットアップ

### TestContainers とは

テストコードから Docker コンテナを起動・停止できる Java ライブラリ。テスト時に「本物の PostgreSQL」を使いたいとき、従来は以下の2択しかなかった。

| 方法 | 問題点 |
| --- | --- |
| モック（偽のDB）を使う | 本番と動作が違う。見つかるはずのバグを見落とす |
| 外部のDBサーバーを用意する | 環境ごとに接続情報が違う。CI での管理が面倒 |

TestContainers を使うとテスト実行時に Docker コンテナが自動で立ち上がり、テスト終了後に自動で消えるため、両方の問題が解決する。

**`@ServiceConnection` について**

Spring Boot 3.1 で追加された仕組み。TestContainers が起動したコンテナの接続情報（ホスト・ポート・DB名・パスワード）を Spring Boot に自動で注入する。`application.yml` にテスト用の接続情報を手書きしなくて済む。

```
テスト実行
  ↓
@Container で postgres コンテナ起動（Docker）
  ↓
@ServiceConnection が接続情報を自動注入
  ↓
Spring Boot アプリが本物の PostgreSQL に接続してテスト
  ↓
テスト終了 → コンテナ自動削除
```

---

### 2-1. 依存ライブラリの追加

`backend/build.gradle.kts` の `dependencies` ブロックに追記する。

```kotlin
testImplementation("org.springframework.boot:spring-boot-testcontainers")
testImplementation("org.testcontainers:r2dbc")
```

| ライブラリ | 用途 |
| --- | --- |
| `spring-boot-testcontainers` | `@ServiceConnection` で TestContainers が起動したコンテナの接続情報を Spring Boot に自動注入する |
| `testcontainers:r2dbc` | R2DBC 経由の接続情報を自動注入するためのブリッジ |

### 2-2. テストクラスの更新

`StudyLogApiApplicationTests.java` を `@ServiceConnection` を使ったスタイルに書き換える。

```java
@SpringBootTest
@Testcontainers
class StudyLogApiApplicationTests {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test
    void contextLoads() {
    }
}
```

`@ServiceConnection` を付けることで、TestContainers が起動した PostgreSQL コンテナの接続情報（ホスト・ポート・DB名・認証情報）が Spring Boot に自動注入される。`application.yml` にテスト用の接続情報を手書きする必要がなくなる。

---

## Step 3 — バックエンド: SpotBugs プラグイン追加

`backend/build.gradle.kts` の `plugins` ブロックに追記する。

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.5.14"
    id("io.spring.dependency-management") version "1.1.7"
    id("com.github.spotbugs") version "6.1.7"   // 追加
}
```

同ファイルの末尾に SpotBugs の設定を追記する。

```kotlin
spotbugs {
    toolVersion = "4.9.3"
    excludeFilter = file("config/spotbugs/exclude.xml")
    ignoreFailures = false
}

tasks.withType<com.github.spotbugs.snom.SpotBugsTask> {
    reports.create("xml") { enabled = false }
    reports.create("html") { enabled = true }
}
```

`backend/config/spotbugs/exclude.xml` を作成する（既知の誤検知を除外）。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<FindBugsFilter>
  <!-- Lombokが生成するコードの誤検知を除外 -->
  <Match>
    <Bug pattern="EI_EXPOSE_REP,EI_EXPOSE_REP2" />
  </Match>
</FindBugsFilter>
```

---

## Step 4 — フロントエンド CI ワークフロー作成

`.github/workflows/frontend-ci.yml` を作成する。

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

## Step 5 — バックエンド CI ワークフロー作成

`.github/workflows/backend-ci.yml` を作成する。

TestContainers は Docker を使って自前で PostgreSQL コンテナを起動するため、GitHub Actions の `services` コンテナは不要。`ubuntu-latest` では Docker が標準で利用できる。

```yaml
name: Backend CI

on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - ".github/workflows/backend-ci.yml"
  pull_request:
    branches: [main]
    paths:
      - "backend/**"
      - ".github/workflows/backend-ci.yml"

defaults:
  run:
    working-directory: backend

jobs:
  test:
    name: JUnit Tests (TestContainers)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Setup Java 21
        uses: actions/setup-java@v4
        with:
          java-version: "21"
          distribution: "temurin"

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4

      - name: Run tests
        run: ./gradlew test
        env:
          SPRING_PROFILES_ACTIVE: test

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: test-results
          path: backend/build/reports/tests/test
          retention-days: 14

  static-analysis:
    name: Static Analysis (SpotBugs)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - name: Setup Java 21
        uses: actions/setup-java@v4
        with:
          java-version: "21"
          distribution: "temurin"

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4

      - name: Run SpotBugs
        run: ./gradlew spotbugsMain

      - name: Upload SpotBugs reports
        uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: spotbugs-reports
          path: backend/build/reports/spotbugs/
          retention-days: 14
```

---

## Step 6 — Branch Protection Rule 設定

GitHub リポジトリの **Settings > Branches** から `main` ブランチの保護ルールを設定する。

1. **Branch name pattern:** `main`
2. **Require status checks to pass before merging:** ✅ 有効化
3. **Status checks that are required:**
   - `Lint & build`
   - `Unit Tests (Jest)`
   - `E2E Tests (Playwright)`
   - `JUnit Tests (TestContainers)`
   - `Static Analysis (SpotBugs)`
4. **Require branches to be up to date before merging:** ✅ 有効化
5. **Do not allow bypassing the above settings:** ✅ 有効化（任意）

> **補足:** ステータスチェック名は、各ワークフロー YAML の `name:` フィールド（`jobs.<job_id>.name`）と一致させる必要がある。初回 CI 実行後に検索フィールドに名前が表示されるため、その後で選択する。

---

## ファイル変更サマリー

```
.github/
└── workflows/
    ├── frontend-ci.yml          # 新規作成（Step 4）
    └── backend-ci.yml           # 新規作成（Step 5）
frontend/
├── package.json                 # scripts 追記（Step 1-3）
├── jest.config.ts               # 新規作成（Step 1-1）
├── jest.setup.ts                # 新規作成（Step 1-1）
├── playwright.config.ts         # 新規作成（Step 1-2）
└── e2e/
    └── .gitkeep                 # 新規作成（Step 1-2）
backend/
├── build.gradle.kts             # TestContainers 依存追加（Step 2-1）、SpotBugs プラグイン追記（Step 3）
├── src/test/java/.../StudyLogApiApplicationTests.java  # @ServiceConnection スタイルに更新（Step 2-2）
└── config/
    └── spotbugs/
        └── exclude.xml          # 新規作成（Step 3）
```
