import type { Metadata } from 'next'

import SubjectForm from "@/app/(protected)/subjects/_components/SubjectForm"

export const metadata: Metadata = { title: '科目登録'}

export default function NewSubjectPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold text-gray-900">科目登録</h1>
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <SubjectForm mode="new"/>
            </div>
        </div>
    )
}