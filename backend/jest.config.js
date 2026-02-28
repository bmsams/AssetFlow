/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/scripts'],
  testMatch: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.d\\.ts$',
    '/dist/',
  ],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@ams/types(.*)$': '<rootDir>/packages/types/src$1',
    '^@ams/utils(.*)$': '<rootDir>/packages/utils/src$1',
    '^@ams/database(.*)$': '<rootDir>/packages/database/src$1',
    '^@ams/cache(.*)$': '<rootDir>/packages/cache/src$1',
    '^@ams/events(.*)$': '<rootDir>/packages/events/src$1',
    '^@ams/search(.*)$': '<rootDir>/packages/search/src$1',
    '^@ams/auth(.*)$': '<rootDir>/packages/auth/src$1',
    '^@ams/validation(.*)$': '<rootDir>/packages/validation/src$1',
    '^@ams/pagination(.*)$': '<rootDir>/packages/pagination/src$1',
    '^@ams/asset-service(.*)$': '<rootDir>/packages/services/asset-service/src$1',
    '^@ams/ham-service(.*)$': '<rootDir>/packages/services/ham-service/src$1',
    '^@ams/sam-service(.*)$': '<rootDir>/packages/services/sam-service/src$1',
    '^@ams/eam-service(.*)$': '<rootDir>/packages/services/eam-service/src$1',
    '^@ams/lifecycle-service(.*)$': '<rootDir>/packages/services/lifecycle-service/src$1',
  },
  collectCoverageFrom: [
    'packages/**/src/**/*.ts',
    '!packages/**/src/**/*.d.ts',
    '!packages/**/src/**/index.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  verbose: true,
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Property-based testing configuration
  globals: {
    'fast-check': {
      numRuns: 100,
      verbose: true,
    },
  },
};
