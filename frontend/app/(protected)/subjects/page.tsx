import Link from 'next/link'

import SubjectList from './_components/SubjectList'

export default function SubjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">科目管理</h1>
        <Link
          href="/subjects/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white
            hover:bg-indigo-700 transition-colors"
        >
          科目を追加
        </Link>
      </div>

      <SubjectList />
    </div>
  )
}