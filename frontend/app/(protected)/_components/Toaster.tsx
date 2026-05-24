'use client'

import { useEffect } from 'react'
import { FaCheck, FaExclamationCircle, FaInfoCircle, FaTimes } from 'react-icons/fa' 

import { type Toast, type ToastVariant, useToast } from './ToastContext'

const DISMISS_MS = 3_000

const VARIANT_STYLES: Record<ToastVariant, string> = {
    success: 'border-green-500 text-green-800 bg-green-50',
    error:   'border-red-500   text-red-800   bg-red-50',
    info:    'border-blue-500  text-blue-800  bg-blue-50' 
}

function VariantIcon({ variant } : { variant: ToastVariant }) {
    if (variant === 'success') return <FaCheck             className="h-4 w-4 shrink-0" aria-hidden/>
    if (variant === 'error')   return <FaExclamationCircle className="h-4 w-4 shrink-0" aria-hidden/>
    return                            <FaInfoCircle        className="h-4 w-4 shrink-0" aria-hidden/>
}

function ToastItem({ toast }: { toast: Toast }) {
    const { removeToast } = useToast()

    useEffect(() => {
        const timer = setTimeout(() => removeToast(toast.id), DISMISS_MS)
        return () => clearTimeout(timer)
    }, [toast.id, removeToast])

    return (
        <div
            className={`flex w-80 items-start gap-3 rounded-lg border-l-4 bg-white
                px-4 py-3 shadow-md text-sm ${VARIANT_STYLES[toast.variant]}`}
        >
            <VariantIcon variant={toast.variant} />
            <span className="flex-1">{toast.message}</span>
            <button
                type="button"
                aria-label="通知を閉じる"
                onClick={() => removeToast(toast.id)}
                className="ml-auto shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
                <FaTimes className="h-3 w-3" aria-hidden />
            </button>
        </div>
    )
}

export default function Toaster() {
    const { toasts } = useToast()

    return (
        <div
            role="region"
            aria-live="polite"
            aria-label="通知"
            className="fixed right-4 top-4 z-50 flex flex-col gap-2"
        >
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} />
            ))}
        </div>
    )
}