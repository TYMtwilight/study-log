# 学習ログ＆バッチ分析アプリ API 仕様書

**バージョン：** 0.1  
**更新日：** 2026年4月26日  
**対象サーバー：** Spring Boot + Spring WebFlux

---

## 1. 概要

### 1.1 ベース URL

| 環境 | URL |
|------|-----|
| ローカル | `http://localhost:8080` |
| 本番 | `https://<Cloud Run ドメイン>` |

### 1.2 共通ヘッダー

| ヘッダー | 値 | 説明 |
|----------|----|------|
| `Content-Type` | `application/json` | リクエストボディを送る場合 |
| `Authorization` | `Bearer <token>` | Auth.js v5 が発行する JWT |

---

## 2. 認証

Next.js（Auth.js v5）が発行した JWT を `Authorization: Bearer <token>` に付与して送信する。Spring Boot はトークンを検証し、userId を取り出してリクエストを処理する。未認証・トークン不正の場合は `401` を返す。

---

## 3. 共通仕様

### 3.1 エラーレスポンス

```json
{
  "code": "ERROR_CODE",
  "message": "エラーの説明"
}
```

| HTTP ステータス | 用途 |
|----------------|------|
| `400` | バリデーションエラー |
| `401` | 未認証 |
| `404` | リソースが存在しない |
| `409` | 競合（例: 科目名の重複） |
| `500` | サーバーエラー |

### 3.2 日付・日時フォーマット

| 型 | フォーマット | 例 |
|----|------------|-----|
| 日付 | `YYYY-MM-DD` | `2026-04-26` |
| 日時 | ISO 8601 (UTC) | `2026-04-26T12:30:00Z` |

### 3.3 ID

全リソースの ID は UUID（v4）を使用する。

---

## 4. エンドポイント

### 4.1 学習ログ

#### `GET /api/study-logs` — 一覧取得

**クエリパラメーター**

| パラメーター | 型 | 必須 | デフォルト | 説明 |
|------------|-----|------|-----------|------|
| `from` | date | — | — | 学習日の開始（例: `2026-04-01`） |
| `to` | date | — | — | 学習日の終了（例: `2026-04-30`） |
| `subjectId` | UUID | — | — | 科目 ID |
| `keyword` | string | — | — | メモの部分一致検索 |
| `page` | int | — | `0` | ページ番号（0始まり） |
| `size` | int | — | `20` | 1ページの件数 |

**レスポンス `200`**

```json
{
  "content": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "subject": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Spring Boot"
      },
      "durationMinutes": 120,
      "studiedAt": "2026-04-26",
      "memo": "WebFlux の Router Function を学習した",
      "createdAt": "2026-04-26T12:30:00Z"
    }
  ],
  "totalElements": 42,
  "page": 0,
  "size": 20
}
```

---

#### `POST /api/study-logs` — 登録

**リクエストボディ**

```json
{
  "subjectId": "660e8400-e29b-41d4-a716-446655440001",
  "durationMinutes": 120,
  "studiedAt": "2026-04-26",
  "memo": "WebFlux の Router Function を学習した"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|--------------|
| `subjectId` | UUID | ◯ | 存在する科目 ID |
| `durationMinutes` | int | ◯ | 1以上の整数 |
| `studiedAt` | date | ◯ | — |
| `memo` | string | — | 最大500文字 |

**レスポンス `201`**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "subject": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Spring Boot"
  },
  "durationMinutes": 120,
  "studiedAt": "2026-04-26",
  "memo": "WebFlux の Router Function を学習した",
  "createdAt": "2026-04-26T12:30:00Z"
}
```

---

#### `PUT /api/study-logs/{id}` — 更新

リクエストボディは `POST` と同じ。

**レスポンス `200`** — 更新後のリソース（`POST` と同形式）

**エラー**
- `404` — 指定した ID の学習ログが存在しない

---

#### `DELETE /api/study-logs/{id}` — 削除

**レスポンス `204`** — ボディなし

**エラー**
- `404` — 指定した ID の学習ログが存在しない

---

### 4.2 科目マスター

#### `GET /api/subjects` — 一覧取得

**レスポンス `200`**

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Spring Boot",
    "createdAt": "2026-01-10T00:00:00Z"
  }
]
```

---

#### `POST /api/subjects` — 登録

**リクエストボディ**

```json
{
  "name": "データベース設計"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|--------------|
| `name` | string | ◯ | 1〜50文字、同一名の重複不可 |

**レスポンス `201`** — 登録した科目

**エラー**
- `409` — 同名の科目がすでに存在する

---

#### `PUT /api/subjects/{id}` — 更新

リクエストボディは `POST` と同じ。

**レスポンス `200`** — 更新後の科目

**エラー**
- `404` — 指定した ID の科目が存在しない
- `409` — 変更後の名前が既存の科目と重複する

---

#### `DELETE /api/subjects/{id}` — 削除

紐づく学習ログが存在する場合、学習ログを含めてすべて削除する。

**レスポンス `204`** — ボディなし

**エラー**
- `404` — 指定した ID の科目が存在しない

---

### 4.3 ダッシュボード

#### `GET /api/dashboard/today` — 今日の学習時間

**レスポンス `200`**

```json
{
  "date": "2026-04-26",
  "totalMinutes": 120
}
```

---

#### `GET /api/dashboard/weekly` — 今週の学習時間（科目別）

曜日ごと・科目ごとの学習時間を返す。積み上げ棒グラフの描画に使用する。

**クエリパラメーター**

| パラメーター | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `date` | date | — | 基準日（省略時は今日）。この日を含む週を返す |

**レスポンス `200`**

```json
{
  "weekStart": "2026-04-21",
  "weekEnd": "2026-04-27",
  "days": [
    {
      "date": "2026-04-21",
      "dayOfWeek": "月",
      "subjects": [
        { "subjectId": "660e8400-...", "subjectName": "Spring Boot", "minutes": 50 },
        { "subjectId": "770e8400-...", "subjectName": "Next.js", "minutes": 35 }
      ],
      "totalMinutes": 85
    }
  ]
}
```

---

#### `GET /api/dashboard/monthly-summary` — 月次サマリー

Spring Batch が集計した `DailySummary` テーブルの集計結果を返す。

**クエリパラメーター**

| パラメーター | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `year` | int | ◯ | 対象年（例: `2026`） |
| `month` | int | ◯ | 対象月（例: `4`） |

**レスポンス `200`**

```json
{
  "year": 2026,
  "month": 4,
  "subjects": [
    { "subjectId": "660e8400-...", "subjectName": "Spring Boot", "totalMinutes": 840 },
    { "subjectId": "770e8400-...", "subjectName": "Next.js", "totalMinutes": 580 }
  ],
  "grandTotalMinutes": 2100
}
```

---

### 4.4 バッチ

#### `GET /api/batch/history` — 実行履歴一覧

**クエリパラメーター**

| パラメーター | 型 | 必須 | デフォルト | 説明 |
|------------|-----|------|-----------|------|
| `page` | int | — | `0` | ページ番号 |
| `size` | int | — | `20` | 1ページの件数 |

**レスポンス `200`**

```json
{
  "content": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440010",
      "jobInstanceId": "1",
      "status": "COMPLETED",
      "startedAt": "2026-04-27T00:00:02Z",
      "finishedAt": "2026-04-27T00:00:05Z",
      "processedCount": 12
    }
  ],
  "totalElements": 30,
  "page": 0,
  "size": 20
}
```

`status` の値: `COMPLETED` / `FAILED` / `RUNNING`

---

#### `POST /api/batch/run` — 手動実行

リクエストボディなし。バッチジョブを即時起動する。

**レスポンス `202`**

```json
{
  "jobInstanceId": "42",
  "message": "バッチジョブを開始しました"
}
```

**エラー**
- `409` — 同一ジョブが現在実行中の場合

---

### 4.5 CSV ダウンロード

#### `GET /api/reports/csv` — 月次学習ログ CSV ダウンロード

**クエリパラメーター**

| パラメーター | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `year` | int | ◯ | 対象年（例: `2026`） |
| `month` | int | ◯ | 対象月（例: `4`） |

**レスポンス `200`**

```
Content-Type: text/csv; charset=UTF-8
Content-Disposition: attachment; filename="study-log-2026-04.csv"
```

CSV フォーマット（1行目はヘッダー）:

```
学習日,科目,学習時間（分）,メモ
2026-04-26,Spring Boot,120,WebFlux の Router Function を学習した
2026-04-25,Next.js,90,App Router の Server Components 実装
```

---

### 4.6 SSE（リアルタイム通知）

#### `GET /api/sse/events` — イベントストリーム接続

ブラウザが接続を維持し、サーバーからプッシュ通知を受け取る。ログアウト時に接続が切れ、それ以降のイベントは受信されない。

**レスポンスヘッダー**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**イベント種別**

##### `study-log-created` — 学習ログ登録時

ダッシュボードの今日の合計学習時間を更新するために使用する。

```
event: study-log-created
data: {"todayTotalMinutes": 150}
```

##### `batch-completed` — バッチ完了時

バッチジョブの完了をトーストで通知するために使用する。

```
event: batch-completed
data: {"jobInstanceId": "42", "status": "COMPLETED", "processedCount": 12}
```

---

## 5. データ型定義

### StudyLog

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | UUID | — |
| `subject` | Subject | 科目（id と name） |
| `durationMinutes` | int | 学習時間（分） |
| `studiedAt` | date | 学習日 |
| `memo` | string \| null | メモ |
| `createdAt` | datetime | 作成日時 |

### Subject

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | UUID | — |
| `name` | string | 科目名 |
| `createdAt` | datetime | 作成日時 |

### BatchHistory

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | UUID | — |
| `jobInstanceId` | string | Spring Batch ジョブインスタンス ID |
| `status` | string | `COMPLETED` / `FAILED` / `RUNNING` |
| `startedAt` | datetime | 開始日時 |
| `finishedAt` | datetime \| null | 終了日時（実行中は null） |
| `processedCount` | int | 処理件数 |