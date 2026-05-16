import Header from './_components/Header'

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <>
            <Header />
            <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </>
    )
}