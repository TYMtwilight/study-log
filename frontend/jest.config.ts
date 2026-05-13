import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  coverageProvider: 'v8',
  // testEnvironment: 'jsdom'と書くことで、jest / describe / test / expect
  // などが import なしで全テストファイルから使えるようになる。
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.test.{ts,tsx}'],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', '!app/**/*.d.ts'],
  // (auth) のような括弧つきディレクトリ名を含むパスで Jest の正規表現処理が壊れるため、
  // nextJest の自動設定に頼らず @/ エイリアスを明示する
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
