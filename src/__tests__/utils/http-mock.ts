/**
 * Utilities for mocking HTTP requests in tests
 */
import { jest } from '@jest/globals';
import { Calendar, Event } from '../../models/calendar.js';
import { XMLResponseFactory } from './xml-response-factory.js';

// Import axios but don't use it directly since it's mocked in jest-setup.test.js
import axios from 'axios';

/**
 * Setup axios mock for a test file
 * Must be called at the beginning of each test file to set up the mock properly
 */
export function setupAxiosMock() {
  // Clear previous mocks
  jest.resetAllMocks();

  // Return the mock implementation for configuration
  return axios;
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

    // Use axios mock directly (as any to bypass TypeScript)
    (axios as any).mockResolvedValueOnce(
      this.createResponse(
        response,
        207, // Multi-Status
        {},
        'Multi-Status',
      ),
    );
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

    // Use axios mock directly (as any to bypass TypeScript)
    (axios as any).mockResolvedValueOnce(
      this.createResponse(
        response,
        207, // Multi-Status
        {},
        'Multi-Status',
      ),
    );
  },

  /**
   * Mock a successful calendar creation (MKCALENDAR)
   */
  mockSuccessfulCalendarCreation(): void {
    // Use axios mock directly (as any to bypass TypeScript)
    (axios as any).mockResolvedValueOnce(
      this.createResponse(
        XMLResponseFactory.createMkcalendarResponse(),
        201, // Created
        {},
        'Created',
      ),
    );
  },

  /**
   * Mock a successful property update (PROPPATCH)
   */
  mockSuccessfulPropertyUpdate(): void {
    // Use axios mock directly (as any to bypass TypeScript)
    (axios as any).mockResolvedValueOnce(
      this.createResponse(
        XMLResponseFactory.createProppatchResponse(),
        207, // Multi-Status
        {},
        'Multi-Status',
      ),
    );
  },

  /**
   * Mock a successful calendar or event deletion
   */
  mockSuccessfulDeletion(): void {
    // Use axios mock directly (as any to bypass TypeScript)
    (axios as any).mockResolvedValueOnce(
      this.createResponse(
        '',
        204, // No Content
        {},
        'No Content',
      ),
    );
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

    // Use axios mock directly (as any to bypass TypeScript)
    (axios as any).mockResolvedValueOnce(
      this.createResponse(
        '',
        201, // Created (or 204 No Content for updates, both work)
        headers,
        'Created',
      ),
    );
  },

  /**
   * Mock a successful head request (for ETag)
   * @param etag ETag header value
   */
  mockSuccessfulHeadRequest(etag: string): void {
    // Use axios mock directly (as any to bypass TypeScript)
    (axios as any).mockResolvedValueOnce(this.createResponse('', 200, { etag }, 'OK'));
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

    // Use axios mock directly (as any to bypass TypeScript)
    (axios as any).mockRejectedValueOnce(error);
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

    // Use axios mock directly (as any to bypass TypeScript)
    (axios as any).mockRejectedValueOnce(error);
  },

  /**
   * Mock optimistic concurrency failure (412 Precondition Failed)
   */
  mockConcurrencyFailure(): void {
    this.mockError(412, 'Precondition Failed');
  },
};
