'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { FaBars, FaTimes } from "react-icons/fa"

type NavItem = {
    href: string
    label: string
    // アクティブ判定関数。階層下のページも含める場合は startsWith を使う
    isActive: (pathname: string) => boolean
}

const NAV_ITEMS : NavItem[] = [
    { 
        href: '/',
        label: 'ダッシュボード',
        isActive: (p) => p === '/'
    },
    {
        href: '/study-logs',
        label: '学習ログ',
        isActive: (p) => p === '/study-logs' || p.startsWith('/study-logs/'),
    },
    {
        href: '/subjects',
        label: '科目管理',
        isActive: (p) => p === '/subjects' || p.startsWith('/subjects/'),
    },
    {
        href: '/reports/monthly',
        label: 'CSVダウンロード',
        isActive: (p) => p.startsWith('/reports/monthly')
    },
    {
        href: '/batch-history',
        label: 'バッチ履歴',
        isActive: (p) => p.startsWith('/batch-history'),
    },
]

const linkBase = 'transition-colors hover:text-gray-900'
const linkActive = 'text-gray-900 font-semibold'
const linkInActive = 'text-gray-900'

export default function NavLinks() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    const renderLink = (item: NavItem, onClick?: () => void) => {
        const active = item.isActive(pathname)
        return (
            <Link 
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onClick}
                className={`${linkBase} ${active ? linkActive : linkInActive}`}
            >
                {item.label}
            </Link>
        )
    }

    return (
        <>
            {/* PC 用: 横並びナビゲーション */}
            <nav className="hidden md:flex items-center gap-6 text-sm">
                {NAV_ITEMS.map((item) => renderLink(item))}
            </nav>

            {/* モバイル用: ハンバーガーボタン */}
            <button
                type="button"
                aria-label={open ? 'メニューを閉じる' : 'メニューを開く'}
                aria-expanded={open}
                aria-controls="mobile-nav"
                onClick={() => setOpen((prev) => !prev)}
                className="md:hidden inline-flex items-center justify-center rounded-full p-2 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
                {open ? <FaTimes className="h-5 w-5" /> : <FaBars className="h-5 w-5" />}
            </button>

            {/* モバイル用: ドロワー（開時のみ表示） */}
            {open && (
                <nav
                    id="mobile-nav"
                    className="absolute left-0 right-0 top-full md:hidden
                        flex flex-col gap-1 border-b bg-white px-6 py-3 text-sm shadow-sm"
                >
                    {NAV_ITEMS.map((item) => 
                        renderLink(item, () => setOpen(false)),
                    )}
                </nav>
            )}
        </>
    )
}