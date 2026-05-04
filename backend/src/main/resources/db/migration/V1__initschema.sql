-- =============================
-- V1: アプリケーションスキーマ
-- =============================
-- ユーザー
CREATE TABLE
    users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        image TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

-- 科目マスター
CREATE TABLE
    subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        name VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

-- 学習ログ
CREATE TABLE
    study_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        subject_id UUID NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
        duration_minutes INT NOT NULL CHECK (duration_minutes >= 1),
        studied_at DATE NOT NULL,
        memo VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
    );

-- 日次サマリー（Spring Batch 出力先）
CREATE TABLE
    daily_summaries (
        id UUID primary key default gen_random_uuid (),
        summary_date DATE NOT NULL,
        subject_id UUID NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
        total_minutes INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
        UNIQUE (summary_date, subject_id)
    );

-- バッチ実行履歴（カスタムテーブル）
-- Spring Batch 標準テーブルとは別に、API レスポンス用のサマリーを保持する
CREATE TABLE
    batch_job_histories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        job_instance_id VARCHAR(50) NOT NULL,
        status VARCHAR(10) NOT NULL CHECK (status IN ('COMPLETED', 'FAILED', 'RUNNING')),
        started_at TIMESTAMPTZ NOT NULL,
        finished_at TIMESTAMPTZ,
        processed_count INT NOT NULL DEFAULT 0
    );

-- =============================
-- インデックス
-- =============================
-- 学習ログ: 一覧取得・日次集計バッチで多様するカラム
CREATE INDEX idx_study_logs_user_id ON study_logs (user_id);

CREATE INDEX idx_study_logs_studied_at ON study_logs (studied_at);

CREATE INDEX idx_study_logs_subject_id ON study_logs (subject_id);

-- 日次サマリー: 月次集計クエリで使用
CREATE INDEX idx_daily_summaries_summary_date ON daily_summaries (summary_date);

-- バッチ実行履歴: 一覧表示（開始日時降順）
CREATE INDEX idx_batch_job_histories_started_at ON batch_job_histories (started_at DESC);