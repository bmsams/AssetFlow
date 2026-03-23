// Jest setup file for global test configuration

// Increase timeout for property-based tests
jest.setTimeout(30000);

// Default event publishing environment for tests that invoke @ams/events directly
process.env.EVENTS_TOPIC_ARN = process.env.EVENTS_TOPIC_ARN || 'arn:aws:sns:us-east-1:000000000000:ams-test-events';
process.env.SERVICE_NAME = process.env.SERVICE_NAME || 'ams-test-service';

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
