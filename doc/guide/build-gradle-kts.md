# build.gradle.kts 解説

対象ファイル: `backend/build.gradle.kts`

---

## 1. build.gradle.kts とは

`build.gradle.kts` は **Gradle** というビルドツールの設定ファイルです。`.kts` は Kotlin Script の略で、Kotlin という言語でビルドの設定を書いています。

**Gradle の役割:**

| 役割 | 具体例 |
|------|--------|
| 依存パッケージの管理 | 「Spring Boot を使う」と宣言すると自動でダウンロードしてくれる |
| ビルド | Javaソースコードをコンパイルして `.jar` ファイルを生成する |
| テスト実行 | `./gradlew test` でテストをまとめて実行する |
| 静的解析 | `./gradlew spotbugsMain` でバグの可能性がある箇所を検出する |

npm の `package.json` に相当するものが `build.gradle.kts` です。

---

## 2. 設定ファイル全体

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.5.14"
    id("io.spring.dependency-management") version "1.1.7"
    id("com.github.spotbugs") version "6.4.4"
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-batch")
    implementation("org.springframework.boot:spring-boot-starter-data-r2dbc")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-webflux")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    compileOnly("org.projectlombok:lombok")
    runtimeOnly("org.postgresql:postgresql")
    runtimeOnly("org.postgresql:r2dbc-postgresql")
    annotationProcessor("org.projectlombok:lombok")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("org.testcontainers:r2dbc")
    testImplementation("io.projectreactor:reactor-test")
    testImplementation("org.springframework.batch:spring-batch-test")
    testImplementation("org.springframework.security:spring-security-test")
    testCompileOnly("org.projectlombok:lombok")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
    testAnnotationProcessor("org.projectlombok:lombok")
}

spotbugs {
    toolVersion = "4.9.8"
    excludeFilter = file("config/spotbugs/exclude.xml")
    ignoreFailures = false
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}

tasks.withType<com.github.spotbugs.snom.SpotBugsTask>().configureEach {
    reports.create("xml") { required.set(false) }
    reports.create("html") { required.set(true) }
}
```

---

## 3. 各ブロックの解説

### `plugins` — 使うプラグインの宣言

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.5.14"
    id("io.spring.dependency-management") version "1.1.7"
    id("com.github.spotbugs") version "6.4.4"
}
```

**プラグイン**とは Gradle に機能を追加する拡張機能です。npm の `devDependencies` に近いイメージです。

| プラグイン | 役割 |
|-----------|------|
| `java` | Java プロジェクトとして認識させる（コンパイル・テスト実行などの基本タスクを追加） |
| `org.springframework.boot` | `./gradlew bootRun`（アプリ起動）や `bootJar`（jar生成）タスクを追加。バージョン `3.5.14` を使用 |
| `io.spring.dependency-management` | Spring Boot が管理している依存パッケージのバージョンを自動解決する。これがあるので `dependencies` ブロックにバージョン番号を書かずに済む |
| `com.github.spotbugs` | `./gradlew spotbugsMain` タスクを追加。Javaコードの静的解析（バグの可能性がある箇所の検出）を行う |

---

### `group` / `version` — プロジェクトの識別情報

```kotlin
group = "com.example"
version = "0.0.1-SNAPSHOT"
```

ビルドして生成される `.jar` ファイルの名前や Maven リポジトリ上での識別に使われます。

- **`group`**: 組織・プロジェクトのドメインを逆順にした名前。個人開発では `com.example` のままでも問題ありません
- **`version`**: アプリのバージョン。`SNAPSHOT` は「開発中（まだリリース版でない）」を意味する Maven の慣習です

---

### `java` — Java のバージョン指定

```kotlin
java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}
```

**ツールチェーン**とは「どのバージョンの Java でビルドするか」を Gradle に伝える仕組みです。`JavaLanguageVersion.of(21)` は Java 21 を使うという指定です。

ローカルに Java 21 がなければ Gradle が自動でダウンロードしてくれるため、チームメンバー間でバージョンが揃います。Java 21 は LTS（長期サポート）バージョンで、2023年にリリースされた現行の最新 LTS です。

---

### `configurations` — 依存スコープの設定

```kotlin
configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}
```

**Lombok を使うための設定**です。Lombok はコンパイル時にコードを自動生成するため、`compileOnly`（コンパイル時のみ使うスコープ）と `annotationProcessor`（注釈処理プロセッサのスコープ）の両方に同じライブラリを登録する必要があります。

`extendsFrom` は「`annotationProcessor` に登録されているものを `compileOnly` にも引き継ぐ」という設定です。これにより後述の `dependencies` ブロックで `compileOnly("org.projectlombok:lombok")` と書くだけで済み、重複記述を防げます。

---

### `repositories` — ライブラリのダウンロード先

```kotlin
repositories {
    mavenCentral()
}
```

**Maven Central** は Java のライブラリが集まる公式リポジトリです。npm の npmjs.com に相当します。`dependencies` ブロックで宣言したライブラリはここからダウンロードされます。

---

### `dependencies` — 使うライブラリの宣言

ライブラリの宣言には**スコープ**（いつ使うか）の指定が必要です。

#### スコープの種類

| スコープ | タイミング | 用途 |
|---------|-----------|------|
| `implementation` | コンパイル時 ＋ 実行時 | アプリ本体で使うライブラリ |
| `compileOnly` | コンパイル時のみ | コンパイル後の `.jar` には含めない（Lombok など） |
| `runtimeOnly` | 実行時のみ | 実行時に必要だがコードからは直接参照しない（JDBCドライバなど） |
| `annotationProcessor` | コンパイル時（注釈処理） | コード生成ツール（Lombok など） |
| `testImplementation` | テストのコンパイル時 ＋ 実行時 | テストコードだけで使うライブラリ |
| `testCompileOnly` | テストのコンパイル時のみ | テストコードのコンパイルにだけ使う |
| `testRuntimeOnly` | テストの実行時のみ | テスト実行時にだけ必要 |
| `testAnnotationProcessor` | テストのコンパイル時（注釈処理） | テストコードのコード生成 |

#### 各ライブラリの用途

**アプリ本体（`implementation`）**

| ライブラリ | 用途 |
|-----------|------|
| `spring-boot-starter-actuator` | `/actuator/health` などの運用管理エンドポイントを提供する |
| `spring-boot-starter-batch` | Spring Batch（バッチ処理）を使えるようにする |
| `spring-boot-starter-data-r2dbc` | R2DBC（リアクティブなDB接続）を使えるようにする |
| `spring-boot-starter-jdbc` | JDBC（従来型のDB接続）を使えるようにする。Flyway がJDBCを必要とするため追加している |
| `spring-boot-starter-security` | Spring Security（認証・認可）を使えるようにする |
| `spring-boot-starter-validation` | `@NotNull` などのバリデーションアノテーションを使えるようにする |
| `spring-boot-starter-webflux` | Spring WebFlux（リアクティブなWebフレームワーク）を使えるようにする |
| `spring-boot-starter-oauth2-resource-server` | JWT（JWTトークン）の検証機能を提供する。Auth.js v5 が発行したJWTをバックエンドで検証するために使う |
| `flyway-core` | Flyway（DBマイグレーションツール）の本体 |
| `flyway-database-postgresql` | Flyway の PostgreSQL 対応ドライバ |

**コンパイル時のみ（`compileOnly`）**

| ライブラリ | 用途 |
|-----------|------|
| `org.projectlombok:lombok` | `@Getter` / `@Setter` / `@Builder` などのアノテーションで定型コードを自動生成する。生成後の `.class` ファイルに Lombok 自体は含まれない |

**実行時のみ（`runtimeOnly`）**

| ライブラリ | 用途 |
|-----------|------|
| `org.postgresql:postgresql` | PostgreSQL の JDBC ドライバ。JDBCでDBに接続するときに実行時に使われる |
| `org.postgresql:r2dbc-postgresql` | PostgreSQL の R2DBC ドライバ。R2DBCでDBに接続するときに実行時に使われる |

> **なぜ `runtimeOnly` か：** ドライバはコードから直接 `import` して使うことはなく、Spring が設定に応じて自動で読み込みます。コンパイル時には不要なため `runtimeOnly` にします。

**注釈処理プロセッサ（`annotationProcessor`）**

| ライブラリ | 用途 |
|-----------|------|
| `org.projectlombok:lombok` | Lombok がコンパイル時にコードを生成するためのプロセッサ |

**テスト用（`testImplementation`）**

| ライブラリ | 用途 |
|-----------|------|
| `spring-boot-starter-test` | JUnit 5 / Mockito / AssertJ など、Spring Boot のテストに必要なライブラリをまとめて追加する |
| `spring-boot-testcontainers` | `@ServiceConnection` などの Spring Boot ↔ TestContainers 統合機能を提供する。接続情報を自動でアプリに注入してくれるため、テスト用 `application.yml` でホスト・ポートを手書きする必要がない |
| `org.testcontainers:junit-jupiter` | TestContainers を JUnit 5 から使うためのブリッジ（`@Testcontainers` / `@Container` アノテーションを有効化する） |
| `org.testcontainers:postgresql` | テスト時に PostgreSQL の Docker コンテナを自動起動する。本物のDBを使った統合テストができる |
| `org.testcontainers:r2dbc` | TestContainers が起動したコンテナに R2DBC で接続するためのブリッジ。`spring-boot-testcontainers` と組み合わせて R2DBC の接続情報を自動注入する |
| `io.projectreactor:reactor-test` | WebFlux（リアクティブ）のテストユーティリティ（`StepVerifier` など） |
| `spring-batch-test` | Spring Batch のジョブ・ステップ単位でのテストユーティリティ |
| `spring-security-test` | `@WithMockUser` などの Spring Security テスト用ユーティリティ |

---

### `spotbugs` — 静的解析の設定

```kotlin
spotbugs {
    toolVersion = "4.9.8"
    excludeFilter = file("config/spotbugs/exclude.xml")
    ignoreFailures = false
}
```

| 設定 | 意味 |
|------|------|
| `toolVersion` | SpotBugs エンジン本体のバージョンを固定する |
| `excludeFilter` | 誤検知を除外するルールファイルのパス。Lombok の自動生成コードへの警告などを除外している |
| `ignoreFailures` | `false` にするとバグを検出したときにビルドが失敗する。CI でマージをブロックするために `false` にしている |

---

### `tasks` — タスクの設定

#### テストタスクの設定

```kotlin
tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}
```

`Test` 型のタスクすべてに対して「JUnit Platform（JUnit 5 の実行基盤）を使う」と設定しています。`configureEach` は遅延評価（必要になるまで設定を適用しない）の書き方で、Gradle の推奨スタイルです。

#### SpotBugs レポートの設定

```kotlin
tasks.withType<com.github.spotbugs.snom.SpotBugsTask>().configureEach {
    reports.create("xml") { required.set(false) }
    reports.create("html") { required.set(true) }
}
```

SpotBugs の解析結果レポートのフォーマットを指定しています。XML 形式は無効化し、HTML 形式のみ出力します。HTML はブラウザで開いて内容を確認できるため、開発者が読みやすいフォーマットです。

`reports.create("xml")` の書き方は Kotlin DSL（型安全な静的言語）の書き方で、Groovy DSL の `reports { xml.required = false }` とは異なります。

---

## 4. よく使う Gradle コマンド

```bash
# アプリを起動する
./gradlew bootRun

# ビルド（.jar ファイルを生成する）
./gradlew bootJar

# テストを実行する
./gradlew test

# 静的解析を実行する（メインコード）
./gradlew spotbugsMain

# ビルド・テスト・静的解析をまとめて実行する
./gradlew build

# 生成ファイルを削除する
./gradlew clean
```

---

## 5. まとめ

```
「Java 21 で」
「Spring Boot 3.5 のライブラリを使って」
「PostgreSQL（JDBC + R2DBC 両方）に接続し」
「Flyway でDBスキーマを管理し」
「SpotBugs で静的解析する」
バックエンドアプリのビルド設定
```