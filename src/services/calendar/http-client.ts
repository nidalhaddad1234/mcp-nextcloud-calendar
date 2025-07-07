/**
 * HTTP client for interacting with Nextcloud CalDAV API
 */
import axios from 'axios';
import { createLogger } from '../logger.js';

const logger = createLogger('CalendarHttpClient');

/**
 * Custom error class for CalDAV HTTP errors
 */
export class CalDavError extends Error {
  status?: number;
  isOptimisticConcurrencyFailure: boolean;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CalDavError';
    this.status = status;
    this.isOptimisticConcurrencyFailure = status === 412;
  }
}

export class CalendarHttpClient {
  private authHeader: string;
  private baseUrl: string;
  private caldavUrl: string;

  constructor(baseUrl: string, username: string, appToken: string) {
    this.baseUrl = baseUrl;
    this.caldavUrl = `${baseUrl}/remote.php/dav/calendars/${username}/`;

    // Create Basic Auth header
    // Use global Buffer (available in Node.js)
    // eslint-disable-next-line no-undef
    const auth = Buffer.from(`${username}:${appToken}`).toString('base64');
    this.authHeader = `Basic ${auth}`;
  }

  /**
   * Fetch the ETag for a specific event
   * @param eventUrl The full URL of the event
   * @returns The ETag header value or null if not available
   */
  async getEventEtag(eventUrl: string): Promise<string | null> {
    try {
      logger.debug(`Making HEAD request for event at ${eventUrl} to get ETag`);

      const response = await axios({
        method: 'HEAD',
        url: eventUrl,
        headers: {
          Authorization: this.authHeader,
        },
      });

      return response.headers['etag'] || null;
    } catch (error) {
      logger.error(`HEAD request failed for event:`, error);
      throw this.handleHttpError(error, 'Failed to fetch event ETag');
    }
  }

  /**
   * Get the CalDAV URL for the user
   */
  getCalDavUrl(): string {
    return this.caldavUrl;
  }

  /**
   * Get the base URL for the Nextcloud server
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Make a generic GET request
   * @param url The URL to request
   * @returns The response data
   */
  async get(url: string): Promise<string> {
    try {
      logger.debug(`Making GET request to ${url}`);

      const response = await axios({
        method: 'GET',
        url,
        headers: {
          Authorization: this.authHeader,
        },
      });

      return response.data;
    } catch (error) {
      logger.error(`GET request failed for ${url}:`, error);
      throw this.handleHttpError(error, 'Failed to fetch resource');
    }
  }

  /**
   * Make a generic PUT request
   * @param url The URL to request
   * @param data The data to send
   * @param headers Optional additional headers
   * @returns The response data
   */
  async put(url: string, data: string, headers: Record<string, string> = {}): Promise<string> {
    try {
      logger.debug(`Making PUT request to ${url}`);

      const response = await axios({
        method: 'PUT',
        url,
        headers: {
          Authorization: this.authHeader,
          ...headers,
        },
        data,
      });

      return response.data;
    } catch (error) {
      logger.error(`PUT request failed for ${url}:`, error);
      throw this.handleHttpError(error, 'Failed to update resource');
    }
  }

  /**
   * Make a generic DELETE request
   * @param url The URL to request
   * @returns The response data
   */
  async delete(url: string): Promise<string> {
    try {
      logger.debug(`Making DELETE request to ${url}`);

      const response = await axios({
        method: 'DELETE',
        url,
        headers: {
          Authorization: this.authHeader,
        },
      });

      return response.data;
    } catch (error) {
      logger.error(`DELETE request failed for ${url}:`, error);
      throw this.handleHttpError(error, 'Failed to delete resource');
    }
  }

  /**
   * Make a PROPFIND request with a custom URL
   * @param data XML data for the request
   * @param url Custom URL for the request
   * @param depth Depth of the request (0, 1, or infinity)
   * @returns The response data
   */
  async propfind(data: string, url?: string, depth: string = '1'): Promise<string> {
    try {
      const requestUrl = url || this.caldavUrl;
      logger.debug(`Making PROPFIND request to ${requestUrl}`);

      const response = await axios({
        method: 'PROPFIND',
        url: requestUrl,
        headers: {
          Authorization: this.authHeader,
          Depth: depth,
          'Content-Type': 'application/xml; charset=utf-8',
        },
        data,
      });

      return response.data;
    } catch (error) {
      logger.error('PROPFIND request failed:', error);
      throw this.handleHttpError(error, 'Failed to fetch calendar data');
    }
  }

  /**
   * Make a MKCALENDAR request to create a new calendar
   * @param calendarId The ID for the new calendar
   * @param data XML data for the request
   * @returns The response data
   */
  async mkcalendar(calendarId: string, data: string): Promise<void> {
    try {
      // Validate calendar ID for path safety
      const validatedCalendarId = this.validateComponentId(calendarId, 'Calendar');

      const calendarUrl = `${this.caldavUrl}${validatedCalendarId}/`;
      logger.debug(`Making MKCALENDAR request for calendar ${validatedCalendarId}`);

      await axios({
        method: 'MKCALENDAR',
        url: calendarUrl,
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/xml; charset=utf-8',
        },
        data,
      });
    } catch (error) {
      logger.error(`MKCALENDAR request failed for ${calendarId}:`, error);
      throw this.handleHttpError(error, 'Failed to create calendar');
    }
  }

  /**
   * Make a PROPPATCH request to update calendar properties
   * @param calendarId The ID of the calendar to update
   * @param data XML data for the request
   * @returns The response data
   */
  async proppatch(calendarId: string, data: string): Promise<void> {
    try {
      // Validate calendar ID for path safety
      const validatedCalendarId = this.validateComponentId(calendarId, 'Calendar');

      const calendarUrl = `${this.caldavUrl}${validatedCalendarId}/`;
      logger.debug(`Making PROPPATCH request for calendar ${validatedCalendarId}`);

      await axios({
        method: 'PROPPATCH',
        url: calendarUrl,
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/xml; charset=utf-8',
        },
        data,
      });
    } catch (error) {
      logger.error(`PROPPATCH request failed for ${calendarId}:`, error);
      throw this.handleHttpError(error, 'Failed to update calendar properties');
    }
  }

  /**
   * Make a DELETE request to delete a calendar
   * @param calendarId The ID of the calendar to delete
   */
  async deleteCalendar(calendarId: string): Promise<void> {
    try {
      // Validate calendar ID for path safety
      const validatedCalendarId = this.validateComponentId(calendarId, 'Calendar');

      const calendarUrl = `${this.caldavUrl}${validatedCalendarId}/`;
      logger.debug(`Making DELETE request for calendar ${validatedCalendarId}`);

      await axios({
        method: 'DELETE',
        url: calendarUrl,
        headers: {
          Authorization: this.authHeader,
        },
      });
    } catch (error) {
      logger.error(`DELETE request failed for ${calendarId}:`, error);
      throw this.handleHttpError(error, 'Failed to delete calendar');
    }
  }

  /**
   * Make a REPORT request to fetch calendar events
   * @param calendarId The ID of the calendar to query
   * @param data XML data for the request
   * @returns The response data
   */
  async calendarReport(calendarId: string, data: string): Promise<string> {
    try {
      // Validate calendar ID for path safety
      const validatedCalendarId = this.validateComponentId(calendarId, 'Calendar');

      const calendarUrl = `${this.caldavUrl}${validatedCalendarId}/`;
      logger.debug(`Making REPORT request for calendar ${validatedCalendarId}`);

      const response = await axios({
        method: 'REPORT',
        url: calendarUrl,
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/xml; charset=utf-8',
          Depth: '1',
        },
        data,
      });

      return response.data;
    } catch (error) {
      logger.error(`REPORT request failed for ${calendarId}:`, error);
      throw this.handleHttpError(error, 'Failed to fetch calendar events');
    }
  }

  /**
   * Fetch a specific event by URL
   * @param eventUrl The full URL of the event to fetch
   * @returns The response data (iCalendar format)
   */
  async getEvent(eventUrl: string): Promise<string> {
    try {
      logger.debug(`Making GET request for event at ${eventUrl}`);

      const response = await axios({
        method: 'GET',
        url: eventUrl,
        headers: {
          Authorization: this.authHeader,
          Accept: 'text/calendar',
        },
      });

      return response.data;
    } catch (error) {
      logger.error(`GET request failed for event:`, error);
      throw this.handleHttpError(error, 'Failed to fetch event');
    }
  }

  /**
   * Validate a component ID (calendar ID or event ID) for path safety
   * @param id The ID to validate
   * @param componentType The type of component (for error messages)
   * @returns The validated ID if it passes validation
   * @throws Error if the ID contains unsafe characters
   * @private Internal utility method
   */
  private validateComponentId(id: string, componentType: string): string {
    // Validate that the ID only contains safe characters (alphanumeric, dash, underscore, period)
    const safeIdRegex = /^[a-zA-Z0-9_.-]+$/;

    if (!id) {
      throw new Error(`${componentType} ID is required`);
    }

    if (!safeIdRegex.test(id)) {
      logger.error(`Potentially unsafe ${componentType} ID detected: ${id}`);
      throw new Error(
        `Invalid ${componentType} ID format: Only alphanumeric characters, dash, underscore, and period are allowed`,
      );
    }

    return id;
  }

  /**
   * Send an event creation or update request
   * @param calendarId The ID of the calendar
   * @param eventId The ID of the event
   * @param iCalData The event data in iCalendar format
   * @param etag Optional ETag for concurrency control (if provided, used for update; if not, used for creation)
   * @returns True if the operation was successful
   * @private Internal method to avoid code duplication
   */
  private async sendEventRequest(
    calendarId: string,
    eventId: string,
    iCalData: string,
    etag?: string,
  ): Promise<boolean> {
    // Validate IDs for path safety
    const validatedCalendarId = this.validateComponentId(calendarId, 'Calendar');
    const validatedEventId = this.validateComponentId(eventId, 'Event');

    // Construct URL with validated IDs
    const eventUrl = `${this.caldavUrl}${validatedCalendarId}/${validatedEventId}.ics`;
    const isUpdate = etag ? true : false;
    const logAction = isUpdate ? 'update' : 'create';

    logger.debug(
      `Making PUT request to ${logAction} event ${validatedEventId} in calendar ${validatedCalendarId}`,
    );

    try {
      // Set up conditional headers based on whether this is a create or update operation
      const conditionalHeader = isUpdate
        ? { 'If-Match': etag } // Update existing - only if matches ETag
        : { 'If-None-Match': '*' }; // Create new - only if doesn't exist

      await axios({
        method: 'PUT',
        url: eventUrl,
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'text/calendar; charset=utf-8',
          ...conditionalHeader,
        },
        data: iCalData,
      });

      return true;
    } catch (error) {
      logger.error(`PUT request failed to ${logAction} event ${validatedEventId}:`, error);
      throw this.handleHttpError(error, `Failed to ${logAction} event`);
    }
  }

  /**
   * Create or update an event
   * @param calendarId The ID of the calendar
   * @param eventId The ID of the event
   * @param iCalData The event data in iCalendar format
   * @returns True if the operation was successful
   */
  async putEvent(calendarId: string, eventId: string, iCalData: string): Promise<boolean> {
    return this.sendEventRequest(calendarId, eventId, iCalData);
  }

  /**
   * Update an existing event
   * @param calendarId The ID of the calendar
   * @param eventId The ID of the event
   * @param iCalData The updated event data in iCalendar format
   * @param etag The ETag of the current version to prevent conflicts
   * @returns True if the operation was successful
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    iCalData: string,
    etag: string,
  ): Promise<boolean> {
    return this.sendEventRequest(calendarId, eventId, iCalData, etag);
  }

  /**
   * Delete an event
   * @param calendarId The ID of the calendar containing the event
   * @param eventId The ID of the event to delete
   * @returns True if the operation was successful
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<boolean> {
    try {
      // Validate IDs for path safety
      const validatedCalendarId = this.validateComponentId(calendarId, 'Calendar');
      const validatedEventId = this.validateComponentId(eventId, 'Event');

      const eventUrl = `${this.caldavUrl}${validatedCalendarId}/${validatedEventId}.ics`;
      logger.debug(
        `Making DELETE request for event ${validatedEventId} in calendar ${validatedCalendarId}`,
      );

      await axios({
        method: 'DELETE',
        url: eventUrl,
        headers: {
          Authorization: this.authHeader,
        },
      });

      return true;
    } catch (error) {
      logger.error(`DELETE request failed for event ${eventId}:`, error);
      throw this.handleHttpError(error, 'Failed to delete event');
    }
  }

  /**
   * Process HTTP errors and provide meaningful error messages
   * @param error The axios error
   * @param defaultMessage Default error message if specific error cannot be determined
   * @returns CalDavError with meaningful message and status code
   */
  private handleHttpError(error: unknown, defaultMessage: string): CalDavError {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;

      // Handle common HTTP errors with more specific messages
      if (status === 401 || status === 403) {
        return new CalDavError('Unauthorized: You do not have permission for this action.', status);
      } else if (status === 404) {
        return new CalDavError('Resource not found.', status);
      } else if (status === 405) {
        return new CalDavError('Operation not supported by this server.', status);
      } else if (status === 409) {
        return new CalDavError('Conflict: Resource already exists or contains conflicts.', status);
      } else if (status === 412) {
        return new CalDavError(
          'Precondition Failed: The resource was modified by another client. Please refresh and try again.',
          status,
        );
      } else if (status === 423) {
        return new CalDavError('Resource is locked and cannot be modified.', status);
      } else if (status === 507) {
        return new CalDavError('Insufficient storage space.', status);
      }

      // For other status codes, include them in the error
      return new CalDavError(
        `HTTP error ${status}: ${error.response?.statusText || 'Unknown error'}`,
        status,
      );
    }

    // Generic error for unknown cases
    return new CalDavError(defaultMessage);
  }
}
