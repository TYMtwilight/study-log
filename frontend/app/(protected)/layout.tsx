import Header from './_components/Header'
import { ToastProvider } from './_components/ToastContext'
import Toaster from './_components/Toaster'

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ToastProvider>
            <Header />
            <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
            <Toaster />
        </ToastProvider>
    )
}