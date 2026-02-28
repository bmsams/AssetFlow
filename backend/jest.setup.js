// Jest setup file for global test configuration

// Increase timeout for property-based tests
jest.setTimeout(30000);

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  // Keep warn and error for debugging
  warn: console.warn,
  error: console.error,
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
