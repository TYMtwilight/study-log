'use client'

import { useEffect, useId } from 'react'

type ConfirmDialogProps = {
    open:            boolean
    title:           string
    message:         string
    confirmLabel?:   string
    cancelLabel?:    string
    loading?:        boolean
    onConfirm:       () => void
    onCancel:        () => void
}

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'OK',
    cancelLabel  = 'キャンセル',
    loading      = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const id = useId()
    const titleId = `${id}-title`
    const descId = `${id}-desc`

    // ESC キーで閉じる（削除実行中は無効）
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !loading) onCancel()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open, loading, onCancel])

    if(!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => { if (!loading) onCancel() }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            >
                <h2 id={titleId} className="text-lg font-bold text-gray-900">
                    {title}
                </h2>
                <p id={descId} className="mt-2 text-sm text-gray-600">
                    {message}
                </p>
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700
                            hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white
                            hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                        {loading ? '削除中...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}