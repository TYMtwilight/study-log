import type { Subject } from '@/types/subject'

// Phase 1: 同一オリジンの Next.js Route Handler（モック）を叩く。
// Phase 2: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/subjects` に変え、JWT を付ける。
const BASE = '/api/subjects'

// HTTP エラーをステータスコード付きで表現するカスタムエラークラス
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// 科目一覧を取得する
export async function fetchSubjects(signal?: AbortSignal): Promise<Subject[]> {
  // ブラウザの HTTP キャッシュを使わず毎回サーバーから取得する
  const res = await fetch(BASE, { cache: 'no-store', signal })
  if (!res.ok) {
    throw new Error(`科目一覧の取得に失敗しました (${res.status})`)
  }
  return res.json() as Promise<Subject[]>
}

// 科目を1件取得する
export async function fetchSubjectById(id: string, signal?: AbortSignal): Promise<Subject> {
  const res = await fetch(`${BASE}/${id}`, { cache: 'no-store', signal })
  if (!res.ok) {
    const body = await res.json().catch(() => {})
    throw new ApiError(res.status, body.message ?? `科目の取得に失敗しました (${res.status})`)
  }
  return res.json() as Promise<Subject>
}

// 科目を新規登録する
export async function createSubject(name: string): Promise<Subject> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => {})
    throw new ApiError(res.status, body.message ?? `科目の登録に失敗しました (${res.status})`)
  }
  return res.json() as Promise<Subject>
}

// 科目名を更新する
export async function updateSubject(id: string, name: string): Promise<Subject> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  if(!res.ok) {
    const body = await res.json().catch(() => {})
    throw new ApiError(res.status, body.message ?? `科目の更新に失敗しました (${res.status})`)
  }
  return res.json() as Promise<Subject>
}


// 科目を1件削除する
export async function deleteSubject(id: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE', signal })
  if (!res.ok) {
    throw new Error(`科目の削除に失敗しました (${res.status})`)
  }
}
