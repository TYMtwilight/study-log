# backend-ci.yml 解説

対象ファイル: `.github/workflows/backend-ci.yml`

---

## 1. このファイルの役割

`.github/workflows/backend-ci.yml` は、バックエンド（Spring Boot）のコードが変更されたときに自動でテスト・静的解析を実行する **CI（Continuous Integration / 継続的インテグレーション）** の設定ファイルです。

| CI がない場合 | CI がある場合 |
|-------------|-------------|
| 手動でテストを実行し忘れる | PR を出すと自動でテストが走る |
| 「自分の環境では動いた」問題が起きる | 統一された環境で毎回検証される |
| バグ混入に気づくのが遅れる | マージ前に問題を検出できる |

`.github/workflows/` ディレクトリに置いた YAML ファイルが、GitHub Actions のワークフロー設定ファイルです。

---

## 2. 設定ファイル全体

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

## 3. 全体の構造

このファイルは大きく 4 つのブロックで構成されています。

```
name        → ワークフローの名前
on          → いつ実行するか（トリガー）
defaults    → 全ジョブ共通の設定
jobs        → 実際に行う処理（2 つのジョブを並列で実行）
  ├── test             → JUnit + TestContainers によるテスト
  └── static-analysis → SpotBugs による静的解析
```

---

## 4. 各ブロックの解説

### `name` — ワークフローの名前

```yaml
name: Backend CI
```

GitHub の Actions タブに表示される名前です。`frontend-ci.yml` と区別するために使います。

---

### `on` — いつ実行するか（トリガー）

```yaml
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
```

**`push`** と **`pull_request`** の 2 種類のタイミングで実行します。

| キー | 意味 |
|------|------|
| `push` | main ブランチへの直接プッシュ時 |
| `pull_request` | main ブランチへの PR 作成・更新時 |
| `branches: [main]` | main ブランチへの変更だけを対象にする |
| `paths` | 指定したパスのファイルが変更されたときだけ実行する |

**`paths` の効果:**

`backend/` 以下のファイル、またはこのワークフローファイル自体が変更されたときだけ CI が動きます。フロントエンドだけ変更した PR ではバックエンド CI はスキップされます。

```
backend/src/Main.java を変更          → ✅ CI が動く
frontend/app/page.tsx を変更          → ❌ CI はスキップ
```

---

### `defaults` — 全ジョブ共通の設定

```yaml
defaults:
  run:
    working-directory: backend
```

`run:` で実行するシェルコマンドのデフォルト作業ディレクトリを `backend/` に設定しています。これにより各ステップで `cd backend && ./gradlew test` と書かずに `./gradlew test` だけで済みます。

> **なぜ必要か:** このリポジトリはルートに `frontend/`・`backend/` が並ぶ**モノレポ**構成です。GitHub Actions は最初リポジトリルートで動き始めるため、`working-directory` を指定しないと `./gradlew` が見つからず失敗します。

---

### `jobs` — 実際に行う処理

2 つのジョブが**並列で**実行されます。それぞれ独立した仮想マシン（Ubuntu）が割り当てられ、同時に動きます。

```
GitHub Actions の実行イメージ:

test              ──────────────────────────→ 完了
static-analysis   ──────────────→ 完了
                  ↑ 2 つが同時にスタート
```

---

#### ジョブ共通の設定項目

```yaml
runs-on: ubuntu-latest
```

ジョブを実行する仮想マシンの OS を指定します。`ubuntu-latest` は GitHub が提供する最新の Ubuntu 環境です。`ubuntu-latest` では Docker が標準で利用できます（TestContainers が使う理由はこの後説明します）。

---

#### ステップ共通パターン

2 つのジョブはいずれも最初に同じ 3 ステップを踏みます。

**ステップ 1 — コードのチェックアウト**

```yaml
- uses: actions/checkout@v6
```

GitHub のリポジトリをこの仮想マシン上にクローンします。これがないとソースコードにアクセスできません。

**ステップ 2 — Java のセットアップ**

```yaml
- name: Setup Java 21
  uses: actions/setup-java@v4
  with:
    java-version: "21"
    distribution: "temurin"
```

| 設定 | 意味 |
|------|------|
| `java-version: "21"` | Java 21 をインストールする |
| `distribution: "temurin"` | Eclipse Adoptium が提供する OpenJDK ディストリビューションを使う |

**Temurin とは**

Java には複数のディストリビューション（配布元）があります。`temurin` は Eclipse Adoptium が無償で提供する OpenJDK で、Oracle JDK の代替として広く使われています。

| ディストリビューション | 提供元 | 備考 |
|----------------------|-------|------|
| `temurin` | Eclipse Adoptium | 無償・広く普及 |
| `corretto` | Amazon | AWS 環境向け |
| `zulu` | Azul Systems | 無償・商用サポートあり |

**ステップ 3 — Gradle のセットアップ**

```yaml
- name: Setup Gradle
  uses: gradle/actions/setup-gradle@v4
```

Gradle ビルドツールをセットアップします。単なるインストールではなく、**ビルドキャッシュの管理**も自動で行います。

> **ビルドキャッシュとは:** Gradle は一度ダウンロードした依存ライブラリ（Spring Boot など）や、変更されていないファイルのビルド結果をキャッシュします。`gradle/actions/setup-gradle` はこのキャッシュを GitHub Actions のキャッシュ機構に保存・復元するため、2 回目以降の実行でビルド時間が大幅に短縮されます。

---

#### `test` ジョブ — JUnit テスト（TestContainers）

```yaml
- name: Run tests
  run: ./gradlew test
  env:
    SPRING_PROFILES_ACTIVE: test
```

Gradle の `test` タスクを実行し、JUnit テストを走らせます。

**`SPRING_PROFILES_ACTIVE: test` とは**

Spring Boot には**プロファイル**という設定切り替え機能があります。環境変数 `SPRING_PROFILES_ACTIVE=test` を渡すことで、`application-test.yml`（またはプロパティ）の設定が読み込まれます。

```
SPRING_PROFILES_ACTIVE の値    読み込まれる設定ファイル
─────────────────────────────────────────────────────
（未指定）                     application.yml
test                           application.yml + application-test.yml
```

テスト用プロファイルでは本番 DB の代わりに TestContainers が管理するテスト用 DB への接続設定が使われます。

**TestContainers とは**

TestContainers は、JUnit テスト実行中に **Docker コンテナを自動で起動・停止**するライブラリです。

```
テスト開始
  ↓
TestContainers が PostgreSQL コンテナを自動起動
  ↓
テストコードが実際の PostgreSQL に接続してテスト実行
  ↓
テスト終了
  ↓
TestContainers がコンテナを自動削除
```

`ubuntu-latest` では Docker が標準で使えるため、GitHub Actions 側で PostgreSQL コンテナを別途用意しなくても TestContainers だけで完結します。

```yaml
- name: Upload test results
  uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}
  with:
    name: test-results
    path: backend/build/reports/tests/test
    retention-days: 14
```

テスト完了後、Gradle が生成した HTML レポートを GitHub にアップロードします。

| 設定 | 意味 |
|------|------|
| `if: ${{ !cancelled() }}` | テストが失敗してもキャンセルされない限りレポートをアップロードする。失敗したときこそレポートが必要なため |
| `path: backend/build/reports/tests/test` | Gradle がテスト結果を出力するデフォルトパス |
| `retention-days: 14` | 14 日間 GitHub 上に保存する。古くなったレポートは自動削除される |

> **`path` とワーキングディレクトリの関係:** `defaults.run.working-directory: backend` は `run:` コマンドにのみ適用されます。`uses:` で呼び出すアクション（`actions/upload-artifact` など）の `path` はリポジトリルートからの相対パスになるため、`backend/build/...` と明示しています。

---

#### `static-analysis` ジョブ — SpotBugs 静的解析

```yaml
- name: Run SpotBugs
  run: ./gradlew spotbugsMain
```

**SpotBugs とは**

SpotBugs は Java のバイトコード（`.class` ファイル）を解析して、バグの可能性があるパターンを検出する**静的解析ツール**です。コードを実際に実行することなく問題を検出します。

| 種別 | 検出できる問題の例 |
|------|--------------------|
| 正確性 | null チェック漏れ、無限ループの可能性 |
| パフォーマンス | 不必要なオブジェクト生成 |
| セキュリティ | SQL インジェクションの可能性 |
| 悪いコード | equals/hashCode の実装ミス |

**`spotbugsMain` タスクとは**

Gradle の SpotBugs プラグインが追加するタスクです。`main` ソースセット（`src/main/java/`）のコードを解析します。テストコード（`src/test/java/`）は対象外です。

```yaml
- name: Upload SpotBugs reports
  uses: actions/upload-artifact@v4
  if: ${{ !cancelled() }}
  with:
    name: spotbugs-reports
    path: backend/build/reports/spotbugs/
    retention-days: 14
```

SpotBugs が生成した HTML レポートをアップロードします。問題が検出されたときにレポートを確認して詳細を把握できます。

---

## 5. CI 実行のイメージ

PR を出したときの流れ：

```
PR を作成
  ↓
GitHub Actions が自動起動
  ↓
┌────────────────────────────────┐  ┌──────────────────────────────┐
│  test                          │  │  static-analysis             │
│  ① checkout                   │  │  ① checkout                  │
│  ② setup-java (temurin 21)    │  │  ② setup-java (temurin 21)   │
│  ③ setup-gradle（キャッシュ）  │  │  ③ setup-gradle（キャッシュ）│
│  ④ ./gradlew test              │  │  ④ ./gradlew spotbugsMain    │
│     └ TestContainers が        │  │     └ バイトコード解析        │
│       PostgreSQL を自動起動    │  │                              │
│  ⑤ upload test-results        │  │  ⑤ upload spotbugs-reports   │
└────────────────────────────────┘  └──────────────────────────────┘
          ↓                                      ↓
        成功/失敗                              成功/失敗
                          ↓
           全ジョブ成功 → PR にマージ可能
           いずれか失敗 → マージをブロック
```

---

## 6. まとめ

```
「backend/ が変更されたとき」
「JUnit テスト（TestContainers）と SpotBugs 静的解析を並列で実行し」
「すべて成功しないと main にマージできない」
バックエンドの CI パイプライン
```