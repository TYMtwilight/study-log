import Image from 'next/image'
import Link from 'next/link'

import { auth, signOut } from '@/auth'

export default async function Header() {
    // auth()の戻り値 session を使ってユーザー情報を参照する
    const session = await auth()

    return (
        <header className="flex items-center justify-between px-6 py-3 border-b bg-white shadow-sm">
            <Link href="/" className="text-lg font-bold text-gray-900">
                STUDY LOG
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
                <Link href="/" className="hover:text-gray-900">ダッシュボード</Link>
                <Link href="/study-logs" className="hover:text-gray-900">学習ログ</Link>
                <Link href="/subjects" className="hover:text-gray-900">科目管理</Link>
                <Link href="/reports/monthly" className="hover:text-gray-900">CSVダウンロード</Link>
                <Link href="/batch-history" className="hover:text-gray-900">バッチ履歴</Link>
            </nav>

            <div className="flex items-center gap-3">
                {session?.user?.image && (
                    <Image
                        src={session.user.image}
                        alt={session.user.name ?? 'ユーザー'}
                        width={32}
                        height={32}
                        className="rounded-full"
                    />
                )}
                <span className="text-sm text-gray-700">{session?.user?.name}</span>

                {/* Server Action でサインアウトを呼び出す */}
                <form
                    action={async() => {
                        // signOut()をエンドポイントとして登録するため'use server'と記載
                        'use server'
                        await signOut({ redirectTo: '/login' })
                    }}
                >
                    <button
                        type="submit"
                        className="rounded-md border border-gray-300 px-3 py-1 text-sm
                            text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        ログアウト
                    </button>
                </form>
            </div>
        </header>

    )
}