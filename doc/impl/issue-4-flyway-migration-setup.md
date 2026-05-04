# DB マイグレーション設定（Flyway）実装手順

**対応 Issue:** [#4 \[セットアップ\] DB マイグレーション設定（Flyway）](https://github.com/TYMtwilight/study-log/issues/4)  
**作成日:** 2026年4月28日  
**前提 Issue:** #2 Spring Boot 初期セットアップ、#3 Docker Compose 環境構築

---

## Step 1 — Flyway 依存関係の追加

`backend/build.gradle.kts` に追記する。

```kotlin
// Flyway（Spring Boot がバージョンを管理するため version 指定不要）
implementation("org.flywaydb:flyway-core")
// Flyway 10.x 以降は PostgreSQL ダイアレクトが別アーティファクト
implementation("org.flywaydb:flyway-database-postgresql")
```

Issue #2 の `application.yml` に既に `spring.flyway.*` の設定は含まれているため、追加設定は不要。

---

## Step 2 — マイグレーションファイルの配置場所

```
backend/src/main/resources/
└── db/
    └── migration/
        ├── V1__init_schema.sql          # アプリケーションテーブル（本 Issue）
        └── V2__spring_batch_schema.sql  # Spring Batch メタテーブル（本 Issue）
```

Flyway のファイル命名規則: `V{バージョン}__{説明}.sql`（アンダースコア 2 つ）

---

## Step 3 — V1\_\_init_schema.sql の作成

アプリケーションのドメインテーブル 5 本を定義する。

```sql
-- =============================
-- V1: アプリケーションスキーマ
-- =============================

-- ユーザー
CREATE TABLE users (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email        VARCHAR(255) NOT NULL UNIQUE,
    name         VARCHAR(255) NOT NULL,
    image        TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 科目マスター
CREATE TABLE subjects (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(50)  NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 学習ログ
CREATE TABLE study_logs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    subject_id       UUID        NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    duration_minutes INT         NOT NULL CHECK (duration_minutes >= 1),
    studied_at       DATE        NOT NULL,
    memo             VARCHAR(500),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 日次サマリー（Spring Batch 出力先）
CREATE TABLE daily_summaries (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date   DATE        NOT NULL,
    subject_id     UUID        NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    total_minutes  INT         NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (summary_date, subject_id)  -- バッチ重複実行を UPSERT で防ぐ
);

-- バッチ実行履歴（カスタムテーブル）
-- Spring Batch 標準テーブルとは別に、API レスポンス用のサマリーを保持する
CREATE TABLE batch_job_histories (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    job_instance_id VARCHAR(50) NOT NULL,
    status          VARCHAR(10) NOT NULL CHECK (status IN ('COMPLETED', 'FAILED', 'RUNNING')),
    started_at      TIMESTAMPTZ NOT NULL,
    finished_at     TIMESTAMPTZ,
    processed_count INT         NOT NULL DEFAULT 0
);

-- =============================
-- インデックス
-- =============================

-- 学習ログ: 一覧取得・日次集計バッチで多用するカラム
CREATE INDEX idx_study_logs_user_id    ON study_logs (user_id);
CREATE INDEX idx_study_logs_studied_at ON study_logs (studied_at);
CREATE INDEX idx_study_logs_subject_id ON study_logs (subject_id);

-- 日次サマリー: 月次集計クエリで使用
CREATE INDEX idx_daily_summaries_summary_date ON daily_summaries (summary_date);

-- バッチ実行履歴: 一覧表示（開始日時降順）
CREATE INDEX idx_batch_job_histories_started_at ON batch_job_histories (started_at DESC);
```

### 設計上のポイント

| 項目                            | 選択                            | 理由                                          |
| ------------------------------- | ------------------------------- | --------------------------------------------- |
| UUID 生成                       | `gen_random_uuid()`             | PostgreSQL 13+ 標準関数。拡張不要             |
| タイムゾーン                    | `TIMESTAMPTZ`                   | UTC で保存。API 仕様書の ISO 8601 形式と整合  |
| 科目名の UNIQUE                 | `subjects.name` に制約          | 重複登録 409 を DB レベルでも保証             |
| `daily_summaries` の複合 UNIQUE | `(summary_date, subject_id)`    | バッチ UPSERT 時の冪等性を保証                |
| `subjects` ON DELETE CASCADE    | `study_logs`, `daily_summaries` | 科目削除時に関連ログも連鎖削除（F-23 の要件） |
| `batch_job_histories`           | Spring Batch 標準テーブルとは別 | API レスポンス用の `processedCount` 等を保持  |

---

## Step 4 — V2\_\_spring_batch_schema.sql の作成

Spring Batch が内部で使用するメタテーブルを定義する。  
Issue #2 で `spring.batch.jdbc.initialize-schema: never` を設定しているため、Flyway で管理する。

```sql
-- =============================================
-- V2: Spring Batch メタテーブル（PostgreSQL 用）
-- =============================================

CREATE SEQUENCE BATCH_STEP_EXECUTION_SEQ  MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE BATCH_JOB_EXECUTION_SEQ   MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE BATCH_JOB_SEQ             MAXVALUE 9223372036854775807 NO CYCLE;

CREATE TABLE BATCH_JOB_INSTANCE (
    JOB_INSTANCE_ID BIGINT       NOT NULL PRIMARY KEY,
    VERSION         BIGINT,
    JOB_NAME        VARCHAR(100) NOT NULL,
    JOB_KEY         VARCHAR(32)  NOT NULL,
    CONSTRAINT JOB_INST_UN UNIQUE (JOB_NAME, JOB_KEY)
);

CREATE TABLE BATCH_JOB_EXECUTION (
    JOB_EXECUTION_ID BIGINT    NOT NULL PRIMARY KEY,
    VERSION          BIGINT,
    JOB_INSTANCE_ID  BIGINT    NOT NULL,
    CREATE_TIME      TIMESTAMP NOT NULL,
    START_TIME       TIMESTAMP DEFAULT NULL,
    END_TIME         TIMESTAMP DEFAULT NULL,
    STATUS           VARCHAR(10),
    EXIT_CODE        VARCHAR(2500),
    EXIT_MESSAGE     VARCHAR(2500),
    LAST_UPDATED     TIMESTAMP,
    CONSTRAINT JOB_INST_EXEC_FK FOREIGN KEY (JOB_INSTANCE_ID)
        REFERENCES BATCH_JOB_INSTANCE (JOB_INSTANCE_ID)
);

CREATE TABLE BATCH_JOB_EXECUTION_PARAMS (
    JOB_EXECUTION_ID BIGINT        NOT NULL,
    PARAMETER_NAME   VARCHAR(100)  NOT NULL,
    PARAMETER_TYPE   VARCHAR(100)  NOT NULL,
    PARAMETER_VALUE  VARCHAR(2500),
    IDENTIFYING      CHAR(1)       NOT NULL,
    CONSTRAINT JOB_EXEC_PARAMS_FK FOREIGN KEY (JOB_EXECUTION_ID)
        REFERENCES BATCH_JOB_EXECUTION (JOB_EXECUTION_ID)
);

CREATE TABLE BATCH_STEP_EXECUTION (
    STEP_EXECUTION_ID  BIGINT       NOT NULL PRIMARY KEY,
    VERSION            BIGINT       NOT NULL,
    STEP_NAME          VARCHAR(100) NOT NULL,
    JOB_EXECUTION_ID   BIGINT       NOT NULL,
    CREATE_TIME        TIMESTAMP    NOT NULL,
    START_TIME         TIMESTAMP    DEFAULT NULL,
    END_TIME           TIMESTAMP    DEFAULT NULL,
    STATUS             VARCHAR(10),
    COMMIT_COUNT       BIGINT,
    READ_COUNT         BIGINT,
    FILTER_COUNT       BIGINT,
    WRITE_COUNT        BIGINT,
    READ_SKIP_COUNT    BIGINT,
    WRITE_SKIP_COUNT   BIGINT,
    PROCESS_SKIP_COUNT BIGINT,
    ROLLBACK_COUNT     BIGINT,
    EXIT_CODE          VARCHAR(2500),
    EXIT_MESSAGE       VARCHAR(2500),
    LAST_UPDATED       TIMESTAMP,
    CONSTRAINT JOB_EXEC_STEP_FK FOREIGN KEY (JOB_EXECUTION_ID)
        REFERENCES BATCH_JOB_EXECUTION (JOB_EXECUTION_ID)
);

CREATE TABLE BATCH_STEP_EXECUTION_CONTEXT (
    STEP_EXECUTION_ID  BIGINT        NOT NULL PRIMARY KEY,
    SHORT_CONTEXT      VARCHAR(2500) NOT NULL,
    SERIALIZED_CONTEXT TEXT,
    CONSTRAINT STEP_EXEC_CTX_FK FOREIGN KEY (STEP_EXECUTION_ID)
        REFERENCES BATCH_STEP_EXECUTION (STEP_EXECUTION_ID)
);

CREATE TABLE BATCH_JOB_EXECUTION_CONTEXT (
    JOB_EXECUTION_ID   BIGINT        NOT NULL PRIMARY KEY,
    SHORT_CONTEXT      VARCHAR(2500) NOT NULL,
    SERIALIZED_CONTEXT TEXT,
    CONSTRAINT JOB_EXEC_CTX_FK FOREIGN KEY (JOB_EXECUTION_ID)
        REFERENCES BATCH_JOB_EXECUTION (JOB_EXECUTION_ID)
);
```

---

## Step 5 — 動作確認

PostgreSQL を起動した状態で Spring Boot を起動する。

```bash
# 1. PostgreSQL 起動（Issue #3）
docker compose up -d

# 2. Spring Boot 起動
cd backend
./gradlew bootRun
```

起動ログに以下が出ていればマイグレーション成功。

```
Successfully applied 2 migrations to schema "public"
  V1__init_schema.sql
  V2__spring_batch_schema.sql
```

### psql でテーブル確認

```bash
docker compose exec postgres psql -U postgres -d studylog -c "\dt"
```

期待出力（7 テーブル + Spring Batch の 5 テーブル + シーケンス）:

```
 Schema |              Name              | Type  |  Owner
--------+--------------------------------+-------+----------
 public | batch_job_execution            | table | postgres
 public | batch_job_execution_context    | table | postgres
 public | batch_job_execution_params     | table | postgres
 public | batch_job_histories            | table | postgres
 public | batch_step_execution           | table | postgres
 public | batch_step_execution_context   | table | postgres
 public | daily_summaries                | table | postgres
 public | study_logs                     | table | postgres
 public | subjects                       | table | postgres
 public | users                          | table | postgres
```

### Flyway の適用状況確認

```bash
curl http://localhost:8080/actuator/flyway
```

> Actuator で Flyway エンドポイントを公開する場合は `application.yml` の `management.endpoints.web.exposure.include` に `flyway` を追加する。

---

## Step 6 — 今後のマイグレーション追加ルール

| ルール                 | 内容                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ファイル名             | `V{次の番号}__{snake_case_description}.sql`                                                                        |
| 既存ファイルの編集禁止 | Flyway は適用済みスクリプトのチェックサムを検証するため、変更すると起動エラーになる                                |
| カラム追加             | `V3__add_xxx_to_yyy.sql` として新ファイルで対応                                                                    |
| ロールバック           | Flyway Community 版はロールバック非対応。誤適用時は手動で `DELETE FROM flyway_schema_history` とテーブル修正を行う |

---

## 完了条件チェック

| 完了条件                                              | 対応ステップ |
| ----------------------------------------------------- | ------------ |
| Flyway 依存関係を追加する                             | Step 1       |
| `V1__init_schema.sql` を作成する                      | Step 3       |
| Spring Boot 起動時にマイグレーションが自動適用される  | Step 5       |
| UUID 型・インデックス・外部キー制約が正しく定義される | Step 3       |
