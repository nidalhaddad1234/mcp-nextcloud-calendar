/**
 * Simple axios mock for testing
 */
import { jest } from '@jest/globals';

// Create a mock function for axios

/**
 * Create a mock version of axios for a specific test
 * @param {Object} options Mock options
 * @returns {Object} Mocked axios
 */
export function createMockAxios(defaultResponse = { data: '', status: 200 }) {
  // Basic implementation that returns the default response
  const mockImpl = jest.fn().mockResolvedValue(defaultResponse);
  
  // Create a queue of responses
  const responseQueue = [];
  
  // Mock implementation that uses the queue
  mockImpl.mockImplementation(() => {
    if (responseQueue.length > 0) {
      const nextResponse = responseQueue.shift();
      return nextResponse instanceof Error ? Promise.reject(nextResponse) : Promise.resolve(nextResponse);
    }
    return Promise.resolve(defaultResponse);
  });
  
  // Add a response to the queue
  mockImpl.mockResponseOnce = (response) => {
    responseQueue.push(response);
    return mockImpl;
  };
  
  // Add an error to the queue
  mockImpl.mockErrorOnce = (error) => {
    responseQueue.push(error instanceof Error ? error : new Error(error));
    return mockImpl;
  };
  
  // Utility to mock isAxiosError
  mockImpl.isAxiosError = jest.fn().mockReturnValue(true);
  
  return mockImpl;
}

// Export for direct import in tests
export default { createMockAxios };