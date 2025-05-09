/**
 * Special Jest setup for axios mocking
 */
import { jest } from '@jest/globals';

// Create a proper mock for axios to be used in all tests
const mockAxios = jest.fn(() => Promise.resolve({ data: '', status: 200 }));

// Add mock methods
mockAxios.mockResolvedValue = jest.fn((value) => {
  mockAxios.mockImplementation(() => Promise.resolve(value));
  return mockAxios;
});

mockAxios.mockResolvedValueOnce = jest.fn((value) => {
  mockAxios.mockImplementationOnce(() => Promise.resolve(value));
  return mockAxios;
});

mockAxios.mockRejectedValue = jest.fn((value) => {
  mockAxios.mockImplementation(() => Promise.reject(value));
  return mockAxios;
});

mockAxios.mockRejectedValueOnce = jest.fn((value) => {
  mockAxios.mockImplementationOnce(() => Promise.reject(value));
  return mockAxios;
});

// Add axios-specific properties
mockAxios.isAxiosError = jest.fn().mockReturnValue(true);
mockAxios.default = mockAxios; // This is the key property needed for proper typing

// Make it work as an ESM module
mockAxios.__esModule = true;

// Mock the axios module
jest.mock('axios', () => mockAxios);

// Export for direct import in tests
export default mockAxios;