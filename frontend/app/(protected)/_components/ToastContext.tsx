'use client'

import { createContext, useCallback, use, useState } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

export type Toast = {
    id:      string
    variant: ToastVariant
    message: string
}

type ToastContextValue = {
    toasts:      Toast[]
    addToast:    (message: string, variant?: ToastVariant) => void
    removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = useCallback((message: string, variant: ToastVariant = 'info' ) => {
        const id = crypto.randomUUID()
        setToasts((prev) => [...prev, { id, variant, message}])
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    return (
        <ToastContext value={{ toasts, addToast, removeToast }}>
            {children}
        </ToastContext>
    )
}

export function useToast(): ToastContextValue {
    const ctx = use(ToastContext)
    if (ctx === null) {
        throw new Error('useToast は ToastProvider の子コンポーネントで使用してください')
    }
    return ctx
}