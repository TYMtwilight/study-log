import type { Subject } from '@/types/subject'

// Phase 1: 同一オリジンの Next.js Route Handler（モック）を叩く。
// Phase 2: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/subjects` に変え、JWT を付ける。
const BASE = '/api/subjects'

// 科目一覧を取得する
export async function fetchSubjects(signal?: AbortSignal): Promise<Subject[]> {
  // ブラウザの HTTP キャッシュを使わず毎回サーバーから取得する
  const res = await fetch(BASE, { cache: 'no-store', signal })
  if (!res.ok) {
    throw new Error(`科目一覧の取得に失敗しました (${res.status})`)
  }
  return res.json() as Promise<Subject[]>
}

// 科目を1件削除する
export async function deleteSubject(id: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', signal })
  if (!res.ok) {
    throw new Error(`科目の削除に失敗しました (${res.status})`)
  }
}
