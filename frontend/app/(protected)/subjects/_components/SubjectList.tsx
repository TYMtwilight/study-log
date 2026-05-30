'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useToast } from '../../_components/ToastContext'

import ConfirmDialog from './ConfirmDialog'


import { fetchSubjects, deleteSubject } from '@/lib/api/subjects'
import type { Subject } from '@/types/subject'

// ISO 文字列を「2026/01/10」形式に整形する
function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
    })
}

export default function SubjectList() {
    const { addToast } = useToast()

    const [subjects, setSubjects] = useState<Subject[]>([])
    const [loading, setLoading]   = useState(true)
    const [error, setError]       = useState<string | null>(null)

    // 削除確認の対象（null = ダイアログ閉）と、削除実行中フラグ
    const [pendingDelete, setPendingDelete] = useState<Subject | null>(null)
    const [deleting, setDeleting]           = useState(false)

    // 初回マウント時に一覧を取得する
    useEffect(() => {
        const controller = new AbortController()
        fetchSubjects(controller.signal)
            .then((data) => {                 
                setSubjects(data);
                setError(null)
            })
            .catch((e) => {
                // AbortError はユーザー操作によるキャンセルなので無視する
                if (e instanceof Error && e.name === 'AbortError') return
                setError(e instanceof Error ? e.message : '読み込みに失敗しました')
            })
            .finally(() => setLoading(false))
        return() => controller.abort()
    }, [])

    // ダイアログで「削除する」を押したとき
    const handleConfirmDelete = async () => {
        if (!pendingDelete) return
        setDeleting(true)
        try {
            await deleteSubject(pendingDelete.id)
            setSubjects((prev) => prev.filter((s) => s.id !== pendingDelete.id))
            addToast('科目を削除しました', 'success')
        } catch (e) {
            addToast(e instanceof Error ? e.message: '削除に失敗しました', 'error')
        } finally {
            setDeleting(false)
            setPendingDelete(null) // 成否にかかわらずダイアログを閉じる
        }
    }

    if (loading) return <p className="text-gray-500">読み込み中 ...</p>
    if (error)   return <p className="text-red-600">{error}</p>
    if (subjects.length === 0) {
        return <p className="text-gray-500">科目が登録されていません。</p>
    }

    return (
        <>
            <div className="overflow-x-auto rounded-lg border border-gray-200" >
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-gray-600">
                        <tr>
                            <th className="px-4 py-3 font-semibold">科目名</th>
                            <th className="px-4 py-3 font-semibold">登録日</th>
                            <th className="px-4 py-3 font-semibold text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subjects.map((subject) => (
                            <tr key={subject.id} className="border-t border-gray-100">
                                <td className="px-4 py-3 text-gray-900">{subject.name}</td>
                                <td className="px-4 py-3 text-gray-600">{formatDate(subject.createdAt)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                        <Link 
                                            href={`/subjects/${subject.id}/edit`}
                                            className="rounded-md border border-gray-300 px-3 py-1 text-gray-700
                                                hover:bg-gray-100 transition-colors"
                                        >
                                            編集
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => setPendingDelete(subject)}
                                            className="rounded-md border border-red-300 px-3 py-1 text-red-600
                                                hover:bg-red-50 transition-colors cursor-pointer"
                                        >
                                            削除
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog 
                open={pendingDelete !== null}
                title="科目を削除しますか？"
                message="科目を削除すると、関連する学習ログもすべて削除されます。よろしいですか？"
                confirmLabel="削除する"
                cancelLabel="キャンセル"
                loading={deleting}
                onConfirm={handleConfirmDelete}
                onCancel={() => setPendingDelete(null)}
            />
        </>
    )
}