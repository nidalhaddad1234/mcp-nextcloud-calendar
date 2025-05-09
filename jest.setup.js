// Import jest
import { jest } from '@jest/globals';

// Mock console to prevent logs after tests complete
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock timers to prevent lingering intervals/timeouts
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Import the cleanup function for MCP transport
import { cleanupAllResources } from './src/handlers/mcp-transport.js';

// Cleanup after each test
afterEach(() => {
  // Clean up any transport resources
  try {
    cleanupAllResources();
  } catch (e) {
    // Ignore errors in cleanup
  }
});

// Cleanup after all tests
afterAll(() => {
  // Clean up any remaining listeners or resources
  jest.clearAllMocks();

  // Final resource cleanup
  try {
    cleanupAllResources();
  } catch (e) {
    // Ignore errors in cleanup
  }
});