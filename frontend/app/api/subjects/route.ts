import { getAllSubjects, createSubject, isNameDuplicate } from '@/lib/subjects/mockStore'

// GET /api/subjects - 科目一覧を返す
export async function GET() {
  return Response.json(getAllSubjects())
}

// POST /api/subjects - 科目を1件登録する
export async function POST(request: Request) {
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
  if (isNameDuplicate(name.trim())) {
    return Response.json(
      { code: 'CONFLICT', message: '同じ名前の科目がすでに存在します' },
      { status: 409 },
    )
  }

  const subject = createSubject(name.trim())
  return Response.json(subject, { status: 201 })
}
