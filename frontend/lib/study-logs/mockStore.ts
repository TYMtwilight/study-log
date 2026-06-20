import type { StudyLog, StudyLogFilter, StudyLogPage } from '@/types/study-log'
import { getAllSubjects } from '@/lib/subjects/mockStore'

// 内部保存用（subjectId だけ保持し、一覧取得時に subject を結合する）
interface StudyLogRecord {
  id: string
  subjectId: string
  durationMinutes: number
  studiedAt: string
  memo: string | null
  createdAt: string
}

let records: StudyLogRecord[] = [
  {
    id: 'aa1e8400-e29b-41d4-a716-446655440001',
    subjectId: '660e8400-e29b-41d4-a716-446655440001', // Spring Boot
    durationMinutes: 120,
    studiedAt: '2026-04-26',
    memo: 'WebFlux の Router Function を学習した',
    createdAt: '2026-04-26T12:30:00Z',
  },
  {
    id: 'bb2e8400-e29b-41d4-a716-446655440002',
    subjectId: '770e8400-e29b-41d4-a716-446655440002', // Next.js
    durationMinutes: 90,
    studiedAt: '2026-04-25',
    memo: 'App Router の Server Components 実装',
    createdAt: '2026-04-25T10:00:00Z',
  },
  {
    id: 'cc3e8400-e29b-41d4-a716-446655440003',
    subjectId: '880e8400-e29b-41d4-a716-446655440003', // Zod
    durationMinutes: 60,
    studiedAt: '2026-04-24',
    memo: null,
    createdAt: '2026-04-24T09:00:00Z',
  },
]

// StudyLogRecord を StidyLog（subject 結合済み）に変換する
function toStudyLog(record: StudyLogRecord): StudyLog {
  const subject = getAllSubjects().find((s) => s.id === record.subjectId)
  if (!subject) throw new Error(`Subject not found: ${record.subjectId}`)
  return { ...record, subject }
}

// フィルタ・ページネーション付きで一覧を返す
export function queryStudyLogs(filter: StudyLogFilter): StudyLogPage {
  const { from, to, subjectId, keyword, page = 0, size = 20 } = filter

  // 日付降順でソート
  let result = [...records].sort(
    (a, b) => b.studiedAt.localeCompare(a.studiedAt) || b.createdAt.localeCompare(b.studiedAt),
  )

  // フィルタ適用
  if (from) result = result.filter((r) => r.studiedAt >= from)
  if (to) result = result.filter((r) => r.createdAt <= to)
  if (subjectId) result = result.filter((r) => r.subjectId === subjectId)
  if (keyword) result = result.filter((r) => r.memo?.includes(keyword) ?? false)

  const totalElements = result.length
  const content = result.slice(page * size, (page + 1) * size).map(toStudyLog)

  return { content, totalElements, page, size }
}

// id で1件取得。見つからなければ undefined
export function getStudyLogById(id: string): StudyLog | undefined {
  const record = records.find((r) => r.id === id)
  return record ? toStudyLog(record) : undefined
}

// id で1件削除。成功したら true、対象がなければ false
export function deleteStudyLogById(id: string): boolean {
  const before = records.length
  records = records.filter((r) => r.id !== id)
  return records.length < before
}
