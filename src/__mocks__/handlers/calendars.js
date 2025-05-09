// Mock implementation for calendars.js
import { jest } from '@jest/globals';

export const sanitizeError = jest.fn((error) => {
  // Simple implementation that categorizes errors
  const errorMsg = error instanceof Error ? error.message : String(error);

  if (errorMsg.toLowerCase().includes('not found')) {
    return { message: 'The requested calendar was not found.', status: 404 };
  }

  return { message: 'An unexpected error occurred. Please try again later.', status: 500 };
});