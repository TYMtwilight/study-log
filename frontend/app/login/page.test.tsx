import { render, screen } from '@testing-library/react'

import LoginPage from './page'

test('ログインページが表示される', () => {
  render(<LoginPage />)
  expect(screen.getByText('ログイン')).toBeInTheDocument()
})