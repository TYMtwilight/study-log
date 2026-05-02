# Docker Compose 環境構築（PostgreSQL）実装手順

**対応 Issue:** [#3 \[セットアップ\] Docker Compose 環境構築（PostgreSQL）](https://github.com/TYMtwilight/study-log/issues/3)  
**作成日:** 2026年4月28日  
**前提 Issue:** #2 Spring Boot プロジェクト初期セットアップ

---

## Step 1 — ファイル構成

リポジトリルートに以下のファイルを作成する。

```
study-log/
├── docker-compose.yml
├── .env               # 実際の値（gitignore 対象）
├── .env.example       # テンプレート（コミット対象）
├── .gitignore
├── frontend/
└── backend/
```

---

## Step 2 — .env.example の作成

```bash
# PostgreSQL
DB_NAME=studylog
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_PORT=5432
```

`.env` は `.env.example` をコピーして作成する。

```bash
cp .env.example .env
```

---

## Step 3 — docker-compose.yml の作成

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: study-log-postgres
    restart: unless-stopped
    ports:
      - "${DB_PORT:-5432}:5432"
    environment:
      POSTGRES_DB: ${DB_NAME:-studylog}
      POSTGRES_USER: ${DB_USERNAME:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${DB_USERNAME:-postgres} -d ${DB_NAME:-studylog}",
        ]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### 設計上のポイント

| 項目           | 選択                 | 理由                                           |
| -------------- | -------------------- | ---------------------------------------------- |
| イメージ       | `postgres:16-alpine` | 軽量・最新安定版                               |
| ボリューム     | named volume         | コンテナ削除後もデータが残る                   |
| ヘルスチェック | `pg_isready`         | Spring Boot 起動前に DB の準備完了を確認できる |
| デフォルト値   | `:-` 記法            | `.env` がなくても起動できるフォールバック      |

---

## Step 4 — .gitignore の新規作成

プロジェクトルートに `.gitignore` を以下の内容で作成する。

```gitignore
# 環境変数（実際の値）
.env
```

> **注意:** `postgres_data` は named volume として Docker が内部で管理するため、プロジェクトディレクトリには生成されない。`.gitignore` への追記は不要。

Next.js（`frontend/`）と Spring Boot（`backend/`）それぞれの `.gitignore` とは別に、**リポジトリルートに配置する**点に注意する。

---

## Step 5 — 起動・接続確認

### コンテナ起動

```bash
docker compose up -d
```

### 起動確認

```bash
docker compose ps
# NAME                    STATUS
# study-log-postgres      Up (healthy)
```

`healthy` になるまで待ってから Spring Boot を起動する（ヘルスチェックが `Up` のままの場合は DB 初期化中）。

### psql で接続確認

```bash
docker compose exec postgres psql -U postgres -d studylog
# psql (16.x)
# studylog=#
```

### Spring Boot から接続確認

Issue #2 の `./gradlew bootRun` を実行し、Actuator のレスポンスを確認する。

```bash
curl http://localhost:8080/actuator/health
```

```json
{
  "status": "UP"
}
```

> **補足:** `application.yml` の `show-details: when-authorized` により、認証なしのリクエストでは `components` は返らない。DB コンポーネントの詳細（`db`・`r2dbc`）を確認したい場合は、ローカル開発時のみ `show-details: always` に変更する。
>
> ```yaml
> management:
>   endpoint:
>     health:
>       show-details: always  # ローカル確認用（本番は when-authorized に戻す）
> ```
>
> その場合のレスポンス:
>
> ```json
> {
>   "status": "UP",
>   "components": {
>     "db": { "status": "UP" },
>     "r2dbc": { "status": "UP" }
>   }
> }
> ```
>
> `db` は Spring Batch / Flyway 用の JDBC 接続、`r2dbc` は WebFlux 用の R2DBC 接続。

---

## Step 6 — よく使うコマンド集

```bash
# バックグラウンドで起動
docker compose up -d

# ログ確認
docker compose logs -f postgres

# 停止（データは保持）
docker compose stop

# 停止 + コンテナ削除（データは保持）
docker compose down

# 停止 + コンテナ・ボリューム削除（データも消える）
docker compose down -v
```

---

## 完了条件チェック

| 完了条件                                                   | 対応ステップ |
| ---------------------------------------------------------- | ------------ |
| `docker-compose.yml` で PostgreSQL コンテナを定義          | Step 3       |
| DB 名・ユーザー名・パスワードを環境変数で設定できる        | Step 2, 3    |
| `docker compose up -d` で起動し Spring Boot から接続できる | Step 5       |
| `.gitignore` に `.env` を追加                              | Step 4       |
