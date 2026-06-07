import {
  getSubjectById,
  deleteSubjectById,
  updateSubjectById,
  isNameDuplicate,
} from '@/lib/subjects/mockStore'

// GET /api/subjects/[id] - 1件取得（編集画面の初期値に使う）
export async function GET(_req: Request, { params }: RouteContext<'/api/subjects/[id]'>) {
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
export async function PUT(request: Request, { params }: RouteContext<'/api/subjects/[id]'>) {
  const { id } = await params

  if (!getSubjectById(id)) {
    return Response.json(
      { code: 'NOT_FOUND', message: '指定した科目が存在しません' },
      { status: 404 },
    )
  }

  const body = await request.json()
  const { name } = body as { name?: string }

  if (!name || name.trim().length === 0) {
    return Response.json({ code: 'VALIDATION_ERROR', message: '科目名は必須です' }, { status: 400 })
  }

  if (name.trim().length > 50) {
    return Response.json(
      { code: 'VALIDATION_ERROR', message: '科目名は50文字以内で入力してください' },
      { status: 400 },
    )
  }

  if (isNameDuplicate(name.trim(), id)) {
    return Response.json(
      { code: 'CONFLICT', message: '同じ名前の科目がすでに存在します' },
      { status: 409 },
    )
  }

  const updated = updateSubjectById(id, name.trim())
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
