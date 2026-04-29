import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '学習ログ',
  description: '日々の学習を記録・可視化するアプリ',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
