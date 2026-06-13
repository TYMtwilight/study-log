import { getAllSubjects, createSubject, isNameDuplicate } from '@/lib/subjects/mockStore'
import { subjectSchema } from '@/lib/subjects/schema'

// GET /api/subjects - 科目一覧を返す
export async function GET() {
  return Response.json(getAllSubjects())
}

// POST /api/subjects - 科目を1件登録する
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  }catch {
    return Response.json(
      { code: 'BAD_REQUEST', message: 'リクエストボディが不正です'},
      { status: 400},
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

  if (isNameDuplicate(name)) {
    return Response.json(
      { code: 'CONFLICT', message: '同じ名前の科目がすでに存在します' },
      { status: 409 },
    )
  }

  const subject = createSubject(name)
  return Response.json(subject, { status: 201 })
}
