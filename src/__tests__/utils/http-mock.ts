/**
 * Utilities for mocking HTTP requests in tests
 */
import axios from 'axios';
import { Calendar, Event } from '../../models/calendar.js';
import { XMLResponseFactory } from './xml-response-factory.js';

// We need to explicitly mock axios
// Since we're using ESM, the jest.mock call must be in the test files themselves

/**
 * HTTP mocking utilities for tests
 */
export const HttpMock = {
  /**
   * Reset all mocks
   */
  reset(): void {
    // When using this in your test, make sure to call jest.resetAllMocks();
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

    // This is used within a jest.mock environment in the test file
    (axios as unknown as jest.Mock).mockResolvedValueOnce({
      data: response,
      status: 207, // Multi-Status
      headers: {},
      config: {} as any,
      statusText: 'Multi-Status',
    });
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

    (axios as unknown as jest.Mock).mockResolvedValueOnce({
      data: response,
      status: 207, // Multi-Status
      headers: {},
      config: {} as any,
      statusText: 'Multi-Status',
    });
  },

  /**
   * Mock a successful calendar creation (MKCALENDAR)
   */
  mockSuccessfulCalendarCreation(): void {
    (axios as unknown as jest.Mock).mockResolvedValueOnce({
      data: XMLResponseFactory.createMkcalendarResponse(),
      status: 201, // Created
      headers: {},
      config: {} as any,
      statusText: 'Created',
    });
  },

  /**
   * Mock a successful property update (PROPPATCH)
   */
  mockSuccessfulPropertyUpdate(): void {
    (axios as unknown as jest.Mock).mockResolvedValueOnce({
      data: XMLResponseFactory.createProppatchResponse(),
      status: 207, // Multi-Status
      headers: {},
      config: {} as any,
      statusText: 'Multi-Status',
    });
  },

  /**
   * Mock a successful calendar or event deletion
   */
  mockSuccessfulDeletion(): void {
    (axios as unknown as jest.Mock).mockResolvedValueOnce({
      data: '',
      status: 204, // No Content
      headers: {},
      config: {} as any,
      statusText: 'No Content',
    });
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

    (axios as unknown as jest.Mock).mockResolvedValueOnce({
      data: '',
      status: 201, // Created (or 204 No Content for updates, both work)
      headers,
      config: {} as any,
      statusText: 'Created',
    });
  },

  /**
   * Mock a successful head request (for ETag)
   * @param etag ETag header value
   */
  mockSuccessfulHeadRequest(etag: string): void {
    (axios as unknown as jest.Mock).mockResolvedValueOnce({
      data: '',
      status: 200,
      headers: {
        etag: etag,
      },
      config: {} as any,
      statusText: 'OK',
    });
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

    (axios as unknown as jest.Mock).mockRejectedValueOnce(error);
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

    (axios as unknown as jest.Mock).mockRejectedValueOnce(error);
  },

  /**
   * Mock optimistic concurrency failure (412 Precondition Failed)
   */
  mockConcurrencyFailure(): void {
    this.mockError(412, 'Precondition Failed');
  },
};
