import { getAllSubjects } from '@/lib/subjects/mockStore'

// GET /api/subjects - 科目一覧を返す
export async function GET() {
  return Response.json(getAllSubjects())
}
