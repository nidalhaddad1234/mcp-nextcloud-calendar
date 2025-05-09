/**
 * Axios mock helper for Jest in ESM environment
 */
import { jest } from '@jest/globals';

// Create a mock for axios module
export const createAxiosMock = () => {
  const mock = jest.fn();

  // Add Jest mock methods
  mock.mockImplementation = jest.fn((impl) => {
    Object.assign(mock, { implementation: impl });
    return mock;
  });

  mock.mockResolvedValue = jest.fn((value) => {
    mock.mockImplementation(() => Promise.resolve(value));
    return mock;
  });

  mock.mockResolvedValueOnce = jest.fn((value) => {
    mock.mockImplementationOnce(() => Promise.resolve(value));
    return mock;
  });

  mock.mockRejectedValue = jest.fn((value) => {
    mock.mockImplementation(() => Promise.reject(value));
    return mock;
  });

  mock.mockRejectedValueOnce = jest.fn((value) => {
    mock.mockImplementationOnce(() => Promise.reject(value));
    return mock;
  });

  // Default implementation
  mock.mockImplementation(() => Promise.resolve({ data: '', status: 200 }));

  // Add more axios methods if needed
  // @ts-expect-error - isAxiosError exists at runtime
  mock.isAxiosError = jest.fn().mockReturnValue(true);

  return mock;
};

/**
 * Set up Jest mock for axios in ESM environment
 */
export const setupAxiosMock = () => {
  const mock = createAxiosMock();

  // Replace the original module
  jest.unstable_mockModule('axios', () => ({
    default: mock,
    __esModule: true,
    // @ts-expect-error - isAxiosError exists at runtime
    isAxiosError: mock.isAxiosError,
  }));

  return mock;
};
