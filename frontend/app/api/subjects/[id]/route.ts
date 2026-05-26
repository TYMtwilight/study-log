import { deleteSubjectById } from '@/lib/subjects/mockStore'

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
