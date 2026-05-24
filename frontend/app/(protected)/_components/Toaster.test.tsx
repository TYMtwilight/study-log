import { act, render, screen } from '@testing-library/react' 
import userEvent from '@testing-library/user-event'

import Toaster from './Toaster'
import { ToastProvider, useToast, ToastVariant } from './ToastContext'

// テスト用ヘルパー: Provider 内から addToast を発火するボタン
function TriggerButton({
    message,
    variant,
}: {
    message: string,
    variant?: ToastVariant
}) {
    const { addToast } = useToast()
    return (
        <button type="button" onClick={() => addToast(message, variant)}>
            トースト追加
        </button>
    )
}

// Provider + Toaster をまとめた Wrapper
function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <ToastProvider>
            {children}
            <Toaster />
        </ToastProvider>
    )
}

describe('Toaster', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(async() => {
        await act(async () => jest.runOnlyPendingTimers())
        jest.useRealTimers()
    })

    test('addToast を呼ぶとトーストが表示される', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime})
        render(
            <Wrapper>
                <TriggerButton message="登録しました" variant="success" />
            </Wrapper>,
        )
        await user.click(screen.getByRole('button', { name: 'トースト追加' }))
        expect(screen.getByText('登録しました')).toBeInTheDocument()
    })

    test('3秒後に自動で消える', async() => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        render(
            <Wrapper>
                <TriggerButton message="登録しました" variant="success" />
            </Wrapper>
        )
        await user.click(screen.getByRole('button', { name: 'トースト追加' }))
        expect(screen.getByText('登録しました')).toBeInTheDocument()

        await act(async() => jest.advanceTimersByTime(3_000))
        expect(screen.queryByText('登録しました')).not.toBeInTheDocument()
    })

    test('複数のトーストを同時に表示できる', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        render(
            <Wrapper>
                <TriggerButton message="メッセージ" variant="info" />
            </Wrapper>
        )
        await user.click(screen.getByRole('button', { name: 'トースト追加'}))
        await user.click(screen.getByRole('button', { name: 'トースト追加'}))
        expect(screen.getAllByText('メッセージ')).toHaveLength(2)
    })

    test('閉じるボタンを押すと即座に消える', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        render(
            <Wrapper>
                <TriggerButton message="手動で閉じる" variant="info" />
            </Wrapper>,
        )
        await user.click(screen.getByRole('button', { name: 'トースト追加' }))
        await user.click(screen.getByRole('button', { name: '通知を閉じる' }))
        expect(screen.queryByText('手動で閉じる')).not.toBeInTheDocument()
    })

    test('通知領域に aria-live="polite" が設定されている', () => {
        render(<Wrapper><div /></Wrapper>)
        expect(
            screen.getByRole('region', { name: '通知' }),
        ).toHaveAttribute('aria-live', 'polite')
    })

    test('複数トーストのうち閉じるボタンを押したものだけ消える', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        render(
            <Wrapper>
                <TriggerButton message="トースト1" variant="success" />
                <TriggerButton message="トースト2" variant="error" />
            </Wrapper>,
        )
        const addButtons = screen.getAllByRole('button', { name: 'トースト追加' })
        await user.click(addButtons[0])
        await user.click(addButtons[1])

        const closeButtons = screen.getAllByRole('button', { name: '通知を閉じる' })
        await user.click(closeButtons[0]) // トースト1だけ閉じる

        expect(screen.queryByText('トースト1')).not.toBeInTheDocument()
        expect(screen.getByText('トースト2')).toBeInTheDocument()
    })

    test('3秒経過したトーストだけ消える', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime})
        render(
            <Wrapper>
                <TriggerButton message="先に追加" variant="success" />
                <TriggerButton message="後から追加" variant="info" />
            </Wrapper>,
        )
        await user.click(screen.getAllByRole('button', { name: 'トースト追加' })[0])

        await act(async() => { jest.advanceTimersByTime(1_000) }) // 1秒経過

        await user.click(screen.getAllByRole('button', { name: 'トースト追加' })[1])

        await act(async() => { jest.advanceTimersByTime(2_000)}) // さらに2秒経過（合計3秒）

        expect(screen.queryByText('先に追加')).not.toBeInTheDocument() // 合計3秒 → 消える
        expect(screen.getByText('後から追加')).toBeInTheDocument() // 2秒しかたっていない → 残る
    })
})