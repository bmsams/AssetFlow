/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@ams/types$': '<rootDir>/../../types/src',
    '^@ams/utils$': '<rootDir>/../../utils/src',
    '^@ams/database$': '<rootDir>/../../database/src',
    '^@ams/cache$': '<rootDir>/../../cache/src',
    '^@ams/events$': '<rootDir>/../../events/src',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
