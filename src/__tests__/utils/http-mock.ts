/**
 * Utilities for mocking HTTP requests in tests
 */
// Note: axios is imported but mocked in test files
import { jest } from '@jest/globals';
import { Calendar, Event } from '../../models/calendar.js';
import { XMLResponseFactory } from './xml-response-factory.js';

// Mock axios for ESM environment
const mockAxiosImpl = jest.fn(() => Promise.resolve({ data: '', status: 200 }));

// Add mock methods to the implementation
mockAxiosImpl.mockResolvedValueOnce = jest.fn();
mockAxiosImpl.mockRejectedValueOnce = jest.fn();

/**
 * Setup axios mock for a test file
 * Must be called at the beginning of each test file to set up the mock properly
 */
export function setupAxiosMock() {
  // Clear previous mocks
  jest.resetAllMocks();

  // Reset the axios mock implementation functions
  mockAxiosImpl.mockResolvedValueOnce.mockReset();
  mockAxiosImpl.mockRejectedValueOnce.mockReset();

  // Return the mock implementation for configuration
  return mockAxiosImpl;
}

/**
 * HTTP mocking utilities for tests
 */
export const HttpMock = {
  /**
   * Create a standard axios response
   */
  createResponse(data: any, status = 200, headers = {}, statusText = 'OK') {
    return {
      data,
      status,
      headers,
      config: {} as any,
      statusText,
    };
  },

  /**
   * Mock a successful calendar fetch (PROPFIND)
   * @param calendars Calendars to include in the response
   * @param options Additional options
   */
  mockSuccessfulCalendarFetch(
    calendars: Calendar[],
    options?: { baseUrl?: string; username?: string },
  ): void {
    const response = XMLResponseFactory.createPropfindResponse({
      calendars,
      baseUrl: options?.baseUrl,
      username: options?.username,
    });

    mockAxiosImpl.mockResolvedValueOnce(this.createResponse(
      response,
      207, // Multi-Status
      {},
      'Multi-Status'
    ));
  },

  /**
   * Mock a successful events fetch (REPORT)
   * @param events Events to include in the response
   * @param options Additional options
   */
  mockSuccessfulEventsFetch(
    events: Event[],
    options?: { baseUrl?: string; username?: string },
  ): void {
    const response = XMLResponseFactory.createEventsReportResponse({
      events,
      baseUrl: options?.baseUrl,
      username: options?.username,
    });

    mockAxiosImpl.mockResolvedValueOnce(this.createResponse(
      response,
      207, // Multi-Status
      {},
      'Multi-Status'
    ));
  },

  /**
   * Mock a successful calendar creation (MKCALENDAR)
   */
  mockSuccessfulCalendarCreation(): void {
    mockAxiosImpl.mockResolvedValueOnce(this.createResponse(
      XMLResponseFactory.createMkcalendarResponse(),
      201, // Created
      {},
      'Created'
    ));
  },

  /**
   * Mock a successful property update (PROPPATCH)
   */
  mockSuccessfulPropertyUpdate(): void {
    mockAxiosImpl.mockResolvedValueOnce(this.createResponse(
      XMLResponseFactory.createProppatchResponse(),
      207, // Multi-Status
      {},
      'Multi-Status'
    ));
  },

  /**
   * Mock a successful calendar or event deletion
   */
  mockSuccessfulDeletion(): void {
    mockAxiosImpl.mockResolvedValueOnce(this.createResponse(
      '',
      204, // No Content
      {},
      'No Content'
    ));
  },

  /**
   * Mock a successful event creation or update
   * @param etag Optional ETag header value
   */
  mockSuccessfulEventWrite(etag?: string): void {
    const headers: Record<string, string> = {};
    if (etag) {
      headers.etag = etag;
    }

    mockAxiosImpl.mockResolvedValueOnce(this.createResponse(
      '',
      201, // Created (or 204 No Content for updates, both work)
      headers,
      'Created'
    ));
  },

  /**
   * Mock a successful head request (for ETag)
   * @param etag ETag header value
   */
  mockSuccessfulHeadRequest(etag: string): void {
    mockAxiosImpl.mockResolvedValueOnce(this.createResponse(
      '',
      200,
      { etag },
      'OK'
    ));
  },

  /**
   * Mock an error response
   * @param status HTTP status code
   * @param message Error message
   */
  mockError(status: number, message: string): void {
    const error = new Error(message);
    (error as any).response = {
      status,
      statusText: message,
      data: XMLResponseFactory.createErrorResponse(status, message),
    };

    mockAxiosImpl.mockRejectedValueOnce(error);
  },

  /**
   * Mock a network error
   * @param message Error message
   */
  mockNetworkError(message: string): void {
    const error = new Error(message);
    (error as any).isAxiosError = true;
    (error as any).request = {}; // Request exists but no response
    (error as any).response = undefined;

    mockAxiosImpl.mockRejectedValueOnce(error);
  },

  /**
   * Mock optimistic concurrency failure (412 Precondition Failed)
   */
  mockConcurrencyFailure(): void {
    this.mockError(412, 'Precondition Failed');
  },
};
