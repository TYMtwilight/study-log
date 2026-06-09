'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { useToast } from '../../_components/ToastContext'

import { 
    createSubject,
    updateSubject,
    fetchSubjectById,
    ApiError,
} from '@/lib/api/subjects'

// バリデーションルール（Zod スキーマ）
const subjectSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1,  '科目名を入力してください')
        .max(50, '科目名は50文字以内で入力してください'),
})

type Props = {
    mode:       'new' | 'edit'
    subjectId?: string
}

export default function SubjectForm({ mode, subjectId }: Props) {
    const router      = useRouter()
    const { addToast } = useToast()

    // フォーム入力値
    const [name, setName] = useState('')
    // Zod バリデーションエラー（フィールド単位）
    const [fieldError, setFieldError] = useState<string | null>(null)
    // API エラー（409 重複など）
    const [apiError, setApiError] = useState<string | null>(null)
    // 送信中フラグ（ボタン二重押し防止）
    const [submitting, setSubmitting] = useState(false)
    // 編集モードの初期データ取得中フラグ
    const [initialLoading, setInitialLoading] = useState(mode === 'edit')
    // 初期データ取得エラー
    const [loadError, setLoadError] = useState<string | null>(null)

    // 編集モード：　マウント時に既存データを取得して name にセットする
    useEffect(() => {
        if (mode !== 'edit' || !subjectId) return
        const controller = new AbortController()
        fetchSubjectById(subjectId, controller.signal)
            .then((subject) => setName(subject.name))
            .catch((e) => {
                if (e instanceof Error && e.name === 'AbortError') return
                setLoadError(e instanceof Error ? e.message : '読み込みに失敗しました')
            })
            .finally(() => setInitialLoading(false))
        return () => controller.abort()
    }, [mode, subjectId])

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault()
        // 前回の送信で表示されたエラーメッセージを消去する
        setFieldError(null)
        setApiError(null)

        // Zod でバリデーション（safeParse は例外を投げず結果オブジェクトを返す）
        const result = subjectSchema.safeParse({ name })
        if(!result.success) {
            setFieldError(result.error.issues[0].message)
            return
        }

        setSubmitting(true)
        try {
            if (mode === 'new') {
                await createSubject(result.data.name)
                addToast('科目を登録しました', 'success')
            } else {
                await updateSubject(subjectId!, result.data.name)
                addToast('科目を更新しました', 'success')
            }
            router.push('/subjects')
            router.refresh()
        } catch (e) {
            if (e instanceof ApiError && e.status === 409) {
                // 重複エラーはフォーム上に表示（トーストではなく）
                setApiError(e.message)
            } else {
                addToast(e instanceof Error ? e.message : '操作に失敗しました', 'error')
            }
        } finally {
            setSubmitting(false)
        }
    }

    // 編集モードで初期データ取得中 / 取得失敗のとき
    if (initialLoading) return <p className="text-gray-500">読み込み中...</p>
    if (loadError) return (
        <div>
            <p className="text-red-500">{loadError}</p>
            <button
                type="button"
                onClick={() => {
                    router.push('/subjects')
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm
                    text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer" 
            >
                一覧に戻る
            </button>
        </div>
    )

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div>
                <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                >
                    科目名 <span className="text-red-500">*</span>
                </label>
                <input 
                    id="name"
                    type="text"
                    value={name}
                    required
                    aria-required="true"
                    onChange={(e) => setName(e.target.value)}
                    aria-describedby={fieldError || apiError ? 'name-error' : undefined}
                    aria-invalid={!!(fieldError || apiError)}
                    className={`w-full rounded-md border px-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-indigo-500
                        ${fieldError || apiError ? 'border-red-400' : 'border-gray-300'}`}
                />
                {(fieldError || apiError) && (
                    <p id="name-error" role="alert" className="mt-1 text-sm text-red-600">
                        {fieldError ?? apiError}
                    </p>
                )}
            </div>

            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    onClick={() => {
                        router.push('/subjects')
                    }}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm
                        text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer" 
                >
                    キャンセル
                </button>
                <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold
                        text-white hover:bg-indigo-700 transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    {submitting ? '保存中' : '保存'}
                </button>

            </div>
        </form>
    )
}