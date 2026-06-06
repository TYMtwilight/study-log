import type { Subject } from '@/types/subject'

let subjects: Subject[] = [
  {
    id: '660e8400-e29b-41d4-a716-446655440001',
    name: 'Spring Boot',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: '770e8400-e29b-41d4-a716-446655440002',
    name: 'Next.js',
    createdAt: '2026-02-15T00:00:00Z',
  },
  { id: '880e8400-e29b-41d4-a716-446655440003', name: 'Zod', createdAt: '2026-03-20T00:00:00Z' },
]

export function getAllSubjects(): Subject[] {
  return [...subjects]
}

// id で1件取得。
// 見つからなければ undefined
export function getSubjectById(id: string): Subject | undefined {
  return subjects.find((s) => s.id === id)
}

// 名前の重複チェック。
// excludedId を指定すると自分自身を除外（更新時に使う）
export function isNameDuplicate(name: string, excludeId?: string): boolean {
  return subjects.some((s) => s.name === name && s.id !== excludeId)
}

// 科目を1件登録して返す
export function createSubject(name: string): Subject {
  const subject: Subject = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
  }
  subjects = [...subjects, subject]
  return subject
}

// id で1件更新。
// 成功したら更新後のオブジェクト、存在しなければ null
export function updateSubjectById(id: string, name: string): Subject | null {
    const idx = subjects.findIndex((s) => s.id === id)
    if(idx === -1) return null
    subjects[idx] = { ...subjects[idx], name }
    return subjects[idx]
}


// id で1件削除。
// 削除できたら true、対象が無ければ false
export function deleteSubjectById(id: string): boolean {
  const before = subjects.length
  subjects = subjects.filter((s) => s.id !== id)
  return subjects.length < before
}
