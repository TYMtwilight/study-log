import { render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import LoginPage from '@/app/(auth)/login/page'

jest.mock('@/auth', () => ({
  auth: jest.fn(),
  signIn: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('Google でログインボタンが表示される', async () => {
    (auth as jest.Mock).mockResolvedValue(null)
    render(await LoginPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('button', { name: /Google でログイン/ })).toBeInTheDocument()
  })

  test('error パラメーターがある場合はエラーメッセージが表示される', async () => {
    (auth as jest.Mock).mockResolvedValue(null)
    render(await LoginPage({ searchParams: Promise.resolve({ error: 'OAuthCallbackError' }) }))
    expect(screen.getByText(/ログインに失敗しました/)).toBeInTheDocument()
  })

  test('error パラメーターがない場合はエラーメッセージが表示されない', async () => {
    (auth as jest.Mock).mockResolvedValue(null)
    render(await LoginPage({ searchParams: Promise.resolve({}) }))
    expect(screen.queryByText(/ログインに失敗しました/)).not.toBeInTheDocument()
  })

  test('ログイン済みの場合は / へリダイレクトされる', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: '1', name: 'テストユーザー', email: 'test@example.com' } })
    await LoginPage({ searchParams: Promise.resolve({}) })
    expect(redirect).toHaveBeenCalledWith('/')
  })
})