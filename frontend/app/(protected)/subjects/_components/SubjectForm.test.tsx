import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'

import { ToastProvider } from '@/app/(protected)/_components/ToastContext'
import Toaster from '@/app/(protected)/_components/Toaster'
import SubjectForm from '@/app/(protected)/subjects/_components/SubjectForm'
import {
    createSubject,
    updateSubject,
    fetchSubjectById,
} from '@/lib/api/subjects'
import { ApiError } from '@/lib/api/utils'

// next/navigation の useRouter をモック化する
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))

// API 関数だけモックにする。ApiError は本物のクラスを使う（instanceof が正しく動くように）
jest.mock('@/lib/api/subjects', () => {
    const actual = jest.requireActual('@/lib/api/subjects')
    return {
        ... actual,
        createSubject:    jest.fn(),
        updateSubject:    jest.fn(),
        fetchSubjectById: jest.fn(),
    }
})

const mockPush      = jest.fn()
const mockCreate    = jest.mocked(createSubject)
const mockUpdate    = jest.mocked(updateSubject)
const mockFetchById = jest.mocked(fetchSubjectById)

const SAMPLE_SUBJECT = { id: 'id-1', name: 'Spring Boot', createdAt: '2026-01-10T00:00:00Z' }

beforeEach(() => {
    jest.clearAllMocks();   
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush })
})

function renderWithProviders(ui: React.ReactElement) {
    return render(
        <ToastProvider>
            {ui}
            <Toaster />
        </ToastProvider>,
    )
}

describe('SubjectForm - 新規登録モード', () => {
    test('科目名を入力して保存すると createSubject が呼ばれ、/subjects へ遷移する', async () => {
        mockCreate.mockResolvedValue(SAMPLE_SUBJECT)
        const user = userEvent.setup()
        renderWithProviders(<SubjectForm mode="new" />)

        await user.type(screen.getByLabelText(/科目名/), 'Spring Boot')
        await user.click(screen.getByRole('button', { name: '保存' }))

        await waitFor(() => 
            expect(mockCreate).toHaveBeenCalledWith('Spring Boot')
        )
        expect(await screen.findByText('科目を登録しました')).toBeInTheDocument()
        expect(mockPush).toHaveBeenCalledWith('/subjects')
    })

    test('科目名が空のまま保存するとバリデーションエラーが表示される', async() => {
        const user = userEvent.setup()
        renderWithProviders(<SubjectForm mode="new" />)

        await user.click(screen.getByRole('button', { name: '保存' }))

        expect(await screen.findByText('科目名を入力してください')).toBeInTheDocument()
        expect(mockCreate).not.toHaveBeenCalled()
    })

    test('51文字の科目名でバリデーションエラーが表示される', async() => {
        const user = userEvent.setup()
        renderWithProviders(<SubjectForm mode="new" />)

        await user.type(screen.getByLabelText(/科目名/), 'あ'.repeat(51))
        await user.click(screen.getByRole('button', { name: '保存' }))

        expect(await screen.findByText('科目名は50文字以内で入力してください')).toBeInTheDocument()
        expect(mockCreate).not.toHaveBeenCalled()
    })

    test('409 エラー時はフォームにエラーメッセージを表示する', async() => {
        mockCreate.mockRejectedValue(new ApiError(409, '同じ名前の科目がすでに存在します'))
        const user = userEvent.setup()
        renderWithProviders(<SubjectForm mode="new" />)

        await user.type(screen.getByLabelText(/科目名/), 'Spring Boot')
        await user.click(screen.getByRole('button', { name: '保存' }))

        expect(await screen.findByText('同じ名前の科目がすでに存在します')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })

    test('キャンセルボタンで /subjects へ遷移する', async() => {
        const user = userEvent.setup()
        renderWithProviders(<SubjectForm mode="new" />)

        await user.click(screen.getByRole('button', { name: 'キャンセル' }))

        expect(mockPush).toHaveBeenCalledWith('/subjects')
    })
})

describe('SubjectForm - 編集モード', () => {
    test('既存の科目名が初期値として表示される', async () => {
        mockFetchById.mockResolvedValue(SAMPLE_SUBJECT)
        mockUpdate.mockResolvedValue({ ... SAMPLE_SUBJECT, name: 'Spring WebFlux' })
        const user = userEvent.setup()
        renderWithProviders(<SubjectForm mode="edit" subjectId="id-1" />)

        const input = await screen.findByDisplayValue('Spring Boot')
        await user.clear(input)
        await user.type(input, 'Spring WebFlux')
        await user.click(screen.getByRole('button', { name: '保存' }))

        await waitFor(() =>
            expect(mockUpdate).toHaveBeenCalledWith('id-1', 'Spring WebFlux'),
        )
        expect(await screen.findByText('科目を更新しました')).toBeInTheDocument()
        expect(mockPush).toHaveBeenCalledWith('/subjects')
    })

    test('初期データ取得失敗時にエラーメッセージを表示する', async() => {
        mockFetchById.mockRejectedValue(new ApiError(404, '指定した科目が存在しません'))
        renderWithProviders(<SubjectForm mode="edit" subjectId="id-999" />)

        expect(await screen.findByText('指定した科目が存在しません')).toBeInTheDocument()
    })
})