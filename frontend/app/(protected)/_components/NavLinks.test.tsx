import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import NavLinks from './NavLinks'

// usePathname のモック
const mockPathname = jest.fn<string, []>()
jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname(),
}))

describe('NavLinks', () => {
    beforeEach(() => {
        mockPathname.mockReset()
    })

    test('現在のパスに対応するリンクに aria-current="page"が付与される', () => {
        mockPathname.mockReturnValue('/study-logs')
        render(<NavLinks />)

        const activeLinks = screen.getAllByRole('link', { name: '学習ログ' })
        // PC 用 nav とモバイル用 nav 両方にレンダリングされる可能性があるため　getAllByRole で確認
        expect(activeLinks[0]).toHaveAttribute('aria-current', 'page')

        const inactiveLinks = screen.getAllByRole('link', { name: 'ダッシュボード' })
        expect(inactiveLinks[0]).not.toHaveAttribute('aria-current')
    })

    test('子パスでも親リンクがアクティブになる', () => {
        mockPathname.mockReturnValue('/study-logs/new')
        render(<NavLinks />)

        const activeLinks = screen.getAllByRole('link', { name: '学習ログ' })
        expect(activeLinks[0]).toHaveAttribute('aria-current', 'page')
    })

    test('ダッシュボードは厳密一致のみアクティブ', () => {
        mockPathname.mockReturnValue('/study-logs')
        render(<NavLinks />)

        const dashboardLinks = screen.getAllByRole('link', { name: 'ダッシュボード' })
        expect(dashboardLinks[0]).not.toHaveAttribute('aria-current')
    })

    test('ハンバーガーボタンを押すとモバイルナビが開閉する', async () => {
        const user = userEvent.setup()
        mockPathname.mockReturnValue('/')
        render(<NavLinks />)

        // 初期状態: モバイルナビは閉じている
        const toggle = screen.getByRole('button', { name: 'メニューを開く' })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')

        // 開く
        await user.click(toggle)
        expect(screen.getByRole('button', { name: 'メニューを閉じる' })).toHaveAttribute(
            'aria-expanded',
            'true',
        )

        // 閉じる
        await user.click(screen.getByRole('button', { name: 'メニューを閉じる' }))
        expect(screen.getByRole('button', { name: 'メニューを開く' })).toHaveAttribute(
            'aria-expanded',
            'false',
        )
    })

    test('ESCキーでドロワーが閉じる', async () => {
        const user = userEvent.setup()
        mockPathname.mockReturnValue('/')
        render(<NavLinks />)

        await user.click(screen.getByRole('button', { name: 'メニューを開く'}))
        expect(screen.getByRole('button', { name: 'メニューを閉じる' })).toBeInTheDocument()

        await user.keyboard('{Escape}')
        expect(screen.getByRole('button', { name: 'メニューを開く' })).toBeInTheDocument()
        
    })

    test('ルート変更時にドロワーが閉じる', async () => {
        const user = userEvent.setup()
        mockPathname.mockReturnValue('/')
        // render() の戻り値から再レンダリング関数（rerender）を取り出す
        const { rerender } = render(<NavLinks />)

        await user.click(screen.getByRole('button', { name: 'メニューを開く'} ))
        expect(screen.getByRole('button', { name: 'メニューを閉じる' })).toBeInTheDocument()

        // パスを変えて再レンダリング
        mockPathname.mockReturnValue('/study-logs')
        rerender(<NavLinks />)
        expect(screen.getByRole('button', { name: 'メニューを開く' })).toBeInTheDocument()
    })
})