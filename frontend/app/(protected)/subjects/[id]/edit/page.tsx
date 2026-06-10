import type { Metadata } from 'next'

import SubjectForm from "@/app/(protected)/subjects/_components/SubjectForm"

export const metadata: Metadata = { title: '科目編集'}

export default async function EditSubjectPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold text-gray-900">科目編集</h1>
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <SubjectForm mode="edit" subjectId={id}/>
            </div>
        </div>
    )
}