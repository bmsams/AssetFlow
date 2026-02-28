/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@ams/types$': '<rootDir>/../../../packages/types/src',
    '^@ams/utils$': '<rootDir>/../../../packages/utils/src',
    '^@ams/database$': '<rootDir>/../../../packages/database/src',
    '^@ams/cache$': '<rootDir>/../../../packages/cache/src',
    '^@ams/events$': '<rootDir>/../../../packages/events/src',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
};
