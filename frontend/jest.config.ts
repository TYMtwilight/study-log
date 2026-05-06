import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.test.{ts,tsx}'],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', '!app/**/*.d.ts'],
}

export default createJestConfig(config)
