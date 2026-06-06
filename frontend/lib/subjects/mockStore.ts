import type { Subject } from '@/types/subject'

let subjects: Subject[] = [
    { id: '660e8400-e29b-41d4-a716-446655440001', name: 'Spring Boot', createdAt: '2026-01-10T00:00:00Z' },
    { id: '770e8400-e29b-41d4-a716-446655440002', name: 'Next.js',     createdAt: '2026-02-15T00:00:00Z' },
    { id: '880e8400-e29b-41d4-a716-446655440003', name: 'Zod',         createdAt: '2026-03-20T00:00:00Z' },
]

export function getAllSubjects(): Subject[] {
    return [...subjects]
}

// id で1件削除。
// 削除できたら true、対象が無ければ false
export function deleteSubjectById(id: string): boolean {
    const before = subjects.length
    subjects = subjects.filter((s) => s.id !== id)
    return subjects.length < before
}