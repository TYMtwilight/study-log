import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ToastProvider } from '../../_components/ToastContext'
import Toaster from '../../_components/Toaster'

import SubjectList from './SubjectList'

import { fetchSubjects, deleteSubject } from '@/lib/api/subjects'

// API クライアントをモックに差し替える
jest.mock('@/lib/api/subjects', () => ({
    fetchSubjects: jest.fn(),
    deleteSubject: jest.fn(),
}))
const mockFetchSubjects = fetchSubjects as jest.Mock
const mockDeleteSubject = deleteSubject as jest.Mock

const SAMPLE = [
    { id: 'id-1', name: 'Spring Boot', createdAt: '2026-01-10T00:00:00Z' },
    { id: 'id-2', name: 'Next.js',     createdAt: '2026-02-15T00:00:00Z' },
]

// Provider + Toaster でラップしてレンダリングする
function renderWithProviders() {
    return render(
        <ToastProvider>
            <SubjectList />
            <Toaster />
        </ToastProvider>,
    )
}

async function clickDeleteButton(user: ReturnType<typeof userEvent.setup>, subjectName: string) {
    const row = (await screen.findByText(subjectName)).closest('tr')!
    await user.click(within(row).getByRole('button', { name: '削除'}))
}

let user: ReturnType<typeof userEvent.setup>
beforeEach(() => {
    jest.clearAllMocks()
    user = userEvent.setup()
})

describe('SubjectList', () => {
    test('取得した科目が一覧表示される', async () => {
        mockFetchSubjects.mockResolvedValue(SAMPLE)
        renderWithProviders()
        expect(await screen.findByText('Spring Boot')).toBeInTheDocument()
        expect(screen.getByText('Next.js')).toBeInTheDocument()
    })

    test('削除ボタンで確認ダイアログが表示される', async () => {
        mockFetchSubjects.mockResolvedValue(SAMPLE)
        renderWithProviders()
        await clickDeleteButton(user, 'Spring Boot')
        
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(
            screen.getByText('科目を削除すると、関連する学習ログもすべて削除されます。よろしいですか？'),
        ).toBeInTheDocument()

    })

    test('キャンセルすると削除されない', async() => {
        mockFetchSubjects.mockResolvedValue(SAMPLE)
        renderWithProviders()

        await clickDeleteButton(user, 'Spring Boot')
        
        await user.click(screen.getByRole('button', { name: 'キャンセル' }))

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(mockDeleteSubject).not.toHaveBeenCalled()
        expect(screen.getByText('Spring Boot')).toBeInTheDocument()
    })

    test('削除確定で行が消え、成功トーストが出る', async() => {
        mockFetchSubjects.mockResolvedValue(SAMPLE)
        mockDeleteSubject.mockResolvedValue(undefined)
        renderWithProviders()
        
        await clickDeleteButton(user, 'Spring Boot')
        
        await user.click(screen.getByRole('button', { name: '削除する' }))

        await waitFor(() => 
            expect(screen.queryByText('Spring Boot')).not.toBeInTheDocument(),
        )
        expect(mockDeleteSubject).toHaveBeenCalledWith('id-1')
        expect(await screen.findByText('科目を削除しました')).toBeInTheDocument()
    })

    test('削除失敗でエラートーストが出て、行は残る', async() => {
        mockFetchSubjects.mockResolvedValue(SAMPLE)
        mockDeleteSubject.mockRejectedValue(new Error('科目の削除に失敗しました（500）'))
        renderWithProviders()

        
        await clickDeleteButton(user, 'Spring Boot')

        await user.click(screen.getByRole('button', { name: '削除する' }))

        expect(await screen.findByText('科目の削除に失敗しました（500）')).toBeInTheDocument()
        expect(screen.getByText('Spring Boot')).toBeInTheDocument()
    })

    test('取得失敗時にエラーメッセージを表示する', async() => {
        mockFetchSubjects.mockRejectedValue(new Error('科目一覧の取得に失敗しました（500）'))
        renderWithProviders()
        expect(
            await screen.findByText('科目一覧の取得に失敗しました（500）'),
        ).toBeInTheDocument()
    })
})