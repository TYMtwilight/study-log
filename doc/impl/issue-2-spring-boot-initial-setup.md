# Spring Boot プロジェクト初期セットアップ 実装手順

**対応 Issue:** [#2 \[セットアップ\] Spring Boot プロジェクト初期セットアップ](https://github.com/TYMtwilight/study-log/issues/2)  
**作成日:** 2026年4月28日  
**更新日:** 2026年4月29日

---

## Step 1 — Spring Initializr でプロジェクト生成

[https://start.spring.io/](https://start.spring.io/) で以下の設定でプロジェクトを生成する。

| 項目        | 値                |
| ----------- | ----------------- |
| Project     | Gradle - Kotlin   |
| Language    | Java              |
| Spring Boot | 3.x（最新安定版） |
| Group       | com.example       |
| Artifact    | study-log-api     |
| Packaging   | Jar               |
| Java        | 21                |

### 追加する依存関係

| 依存関係                   | 用途                                  |
| -------------------------- | ------------------------------------- |
| Spring Reactive Web        | WebFlux（REST API・SSE）              |
| Spring Data R2DBC          | ドメイン API の非同期 DB アクセス     |
| PostgreSQL Driver（R2DBC） | `org.postgresql:r2dbc-postgresql`     |
| Spring Batch               | 日次集計ジョブ（Issue #22）           |
| JDBC API                   | Spring Batch のメタテーブル用（後述） |
| PostgreSQL Driver（JDBC）  | Spring Batch のメタテーブル用（後述） |
| Spring Security            | JWT 認証フィルター（Issue #16）       |
| Spring Boot Actuator       | ヘルスチェックエンドポイント          |
| Validation                 | Bean Validation（`@Valid`）           |
| Lombok                     | ボイラープレート削減（任意）          |
| Flyway Core                | DB マイグレーション管理（Issue #4）   |

> **Spring Batch + WebFlux 共存の注意点**  
> Spring Batch はメタテーブル（`BATCH_JOB_INSTANCE` 等）の操作に JDBC（ブロッキング）を使う。  
> そのため、ドメイン API には R2DBC、Spring Batch には JDBC と**2 種類の接続設定**が必要になる。  
> これは Spring 公式でも認められたパターン。（要件定義書 §6 「WebFluxと同一アプリに同居（習作のため）」）

生成後、ディレクトリ名を `backend/` にリネームする。

```bash
mv study-log-api backend
```

---

## Step 2 — プロジェクト構成の整備

```
backend/
├── src/
│   ├── main/
│   │   ├── java/com/example/studylog/
│   │   │   ├── StudyLogApiApplication.java
│   │   │   ├── batch/               # Spring Batch ジョブ（Issue #22）
│   │   │   │   ├── DailySummaryJob.java
│   │   │   │   ├── DailySummaryReader.java
│   │   │   │   ├── DailySummaryProcessor.java
│   │   │   │   └── DailySummaryWriter.java
│   │   │   ├── config/
│   │   │   │   ├── SecurityConfig.java   # JWT フィルター設定（Issue #16）
│   │   │   │   ├── WebFluxConfig.java    # CORS 設定（Issue #15）
│   │   │   │   └── BatchConfig.java      # Spring Batch 設定
│   │   │   ├── domain/
│   │   │   │   ├── model/           # エンティティ（R2DBC @Table）
│   │   │   │   │   ├── StudyLog.java
│   │   │   │   │   ├── Subject.java
│   │   │   │   │   ├── DailySummary.java
│   │   │   │   │   └── User.java
│   │   │   │   └── repository/      # R2DBC リポジトリ
│   │   │   │       ├── StudyLogRepository.java
│   │   │   │       ├── SubjectRepository.java
│   │   │   │       └── DailySummaryRepository.java
│   │   │   ├── service/             # ビジネスロジック
│   │   │   │   ├── StudyLogService.java
│   │   │   │   ├── SubjectService.java
│   │   │   │   └── DashboardService.java
│   │   │   ├── web/
│   │   │   │   ├── controller/      # @RestController（WebFlux）
│   │   │   │   │   ├── StudyLogController.java
│   │   │   │   │   ├── SubjectController.java
│   │   │   │   │   ├── DashboardController.java
│   │   │   │   │   ├── BatchController.java
│   │   │   │   │   └── SseController.java
│   │   │   │   └── dto/             # リクエスト / レスポンス DTO
│   │   │   └── exception/
│   │   │       └── GlobalExceptionHandler.java  # @ControllerAdvice
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/
│   │           └── migration/       # Flyway スクリプト（Issue #4）
│   └── test/
│       └── java/com/example/studylog/
├── build.gradle.kts
├── settings.gradle.kts
└── gradlew
```

---

## Step 3 — application.yml の設定

```yaml
server:
  port: 8080

spring:
  application:
    name: study-log-api

  # ドメイン API 用（WebFlux / R2DBC）
  r2dbc:
    url: r2dbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:studylog}
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD:postgres}

  # Spring Batch 用（JDBC ブロッキング接続）
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:studylog}
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD:postgres}
    driver-class-name: org.postgresql.Driver

  batch:
    job:
      enabled: false # 起動時の自動実行を抑制（手動・スケジューラーで実行）
    jdbc:
      initialize-schema: never # Spring Batch メタテーブルは Flyway で管理

  # Flyway（マイグレーション）
  flyway:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:studylog}
    user: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD:postgres}
    locations: classpath:db/migration

# Actuator
management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      show-details: when-authorized
```

### ポイント

- `spring.batch.job.enabled=false` を必ず設定する。設定しないとアプリ起動のたびにバッチが実行される。
- R2DBC と JDBC の接続先は同じ DB だが、URL スキームが異なる（`r2dbc:postgresql://` vs `jdbc:postgresql://`）。

---

## Step 4 — .env.example の作成

```bash
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=studylog
DB_USERNAME=postgres
DB_PASSWORD=postgres

# JWT（Auth.js v5 が発行する JWT の検証に使用）
JWT_SECRET=your_jwt_secret_here
```

`.gitignore` に `.env` を追加し、`.env.example` のみをコミットする。

---

## Step 5 — 起動確認

Docker Compose で PostgreSQL を起動してから（Issue #3 完了後）実行する。

```bash
# PostgreSQL 起動
docker compose up -d

# Spring Boot 起動
cd backend
./gradlew bootRun
```

ヘルスチェック確認:

```bash
curl http://localhost:8080/actuator/health
```

期待レスポンス:

```json
{
  "status": "UP",
  "components": {
    "db": { "status": "UP" },
    "r2dbc": { "status": "UP" }
  }
}
```

---

## Step 6 — build.gradle.kts の依存関係確認

Spring Initializr で生成した `build.gradle.kts` に以下が含まれていることを確認する。

```kotlin
plugins {
    java
    id("org.springframework.boot") version "3.5.x"
    id("io.spring.dependency-management") version "1.1.x"
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
    // WebFlux
    implementation("org.springframework.boot:spring-boot-starter-webflux")

    // R2DBC（ドメイン API 用）
    implementation("org.springframework.boot:spring-boot-starter-data-r2dbc")
    runtimeOnly("org.postgresql:r2dbc-postgresql")

    // JDBC（Spring Batch 用）
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    runtimeOnly("org.postgresql:postgresql")

    // Spring Batch
    implementation("org.springframework.boot:spring-boot-starter-batch")

    // Spring Security
    implementation("org.springframework.boot:spring-boot-starter-security")

    // Actuator
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    // Validation
    implementation("org.springframework.boot:spring-boot-starter-validation")

    // Flyway
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")

    // Lombok
    compileOnly("org.projectlombok:lombok")
    annotationProcessor("org.projectlombok:lombok")

    // Test
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("io.projectreactor:reactor-test")
    testImplementation("org.springframework.batch:spring-batch-test")
    testImplementation("org.springframework.security:spring-security-test")
}

tasks.withType<Test> {
    useJUnitPlatform()
}
```

> **バージョンについて**  
> `3.5.x` / `1.1.x` の部分は Spring Initializr が生成した値をそのまま使用する。  
> Gradle の依存関係バージョンは `io.spring.dependency-management` プラグインが Spring Boot BOM から自動管理するため、各依存関係のバージョンは原則として記述しない。

---

## 完了条件チェック

| 完了条件                                                                                             | 対応ステップ |
| ---------------------------------------------------------------------------------------------------- | ------------ |
| Spring Initializr でプロジェクト作成（Gradle - Kotlin、WebFlux, R2DBC, Batch, Security, PostgreSQL） | Step 1       |
| `application.yml` に DB 接続設定・ポート設定を記述                                                   | Step 3       |
| `.env.example` を作成し必要な環境変数を列挙                                                          | Step 4       |
| `GET /actuator/health` が動作することを確認                                                          | Step 5       |
| `./gradlew bootRun` でローカル起動                                                                   | Step 5       |
