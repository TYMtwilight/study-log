import { Subject } from '@/types/subject'

// GET /api/study-logs の content 要素 / POST・PUT のレスポンス
export interface StudyLog {
  id: string
  subject: Subject
  durationMinutes: number
  studiedAt: string // YYYY-MM-DD
  memo: string | null
  createdAt: string // ISO 8601 UTC
}

// GET /api/study-logs のページネーションレスポンス全体
export interface StudyLogPage {
  content: StudyLog[]
  totalElements: number
  page: number
  size: number
}

// GET /api/study-logs のクエリパラメーター
export interface StudyLogFilter {
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD
  subjectId?: string
  keyword?: string
  page?: number
  size?: number
}
