import {
  getSubjectById,
  deleteSubjectById,
  updateSubjectById,
  isNameDuplicate,
} from '@/lib/subjects/mockStore'
import { subjectSchema } from '@/lib/subjects/schema'

// GET /api/subjects/[id] - 1件取得（編集画面の初期値に使う）
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const subject = getSubjectById(id)
  if (!subject) {
    return Response.json(
      { code: 'NOT_FOUND', message: '指定した科目が存在しません' },
      { status: 404 },
    )
  }
  return Response.json(subject)
}

// PUT /api/subjects/[id] - 科目名を更新する
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!getSubjectById(id)) {
    return Response.json(
      { code: 'NOT_FOUND', message: '指定した科目が存在しません' },
      { status: 404 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { code: 'BAD_REQUEST', message: 'リクエストボディが不正です' },
      { status: 400 },
    )
  }
  const result = subjectSchema.safeParse(body)
  if (!result.success) {
    return Response.json(
      { code: 'VALIDATION_ERROR', message: result.error.issues[0].message },
      { status: 400 },
    )
  }
  const { name } = result.data

  if (isNameDuplicate(name, id)) {
    return Response.json(
      { code: 'CONFLICT', message: '同じ名前の科目がすでに存在します' },
      { status: 409 },
    )
  }

  const updated = updateSubjectById(id, name)
  if (!updated) {
    return Response.json(
      { code: 'NOT_FOUND', message: '指定した科目が存在しません' },
      { status: 404 },
    )
  }

  return Response.json(updated)
}

// DELETE /api/subjects/[id] - 科目を1件削除する
export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>
  },
) {
  const { id } = await params
  const deleted = deleteSubjectById(id)

  if (!deleted) {
    return Response.json(
      { code: 'NOT_FOUND', message: '指定した科目が存在しません' },
      { status: 404 },
    )
  }

  return new Response(null, { status: 204 })
}
