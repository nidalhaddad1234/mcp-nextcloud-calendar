/**
 * HTTP client for interacting with Nextcloud CalDAV API
 */
import axios from 'axios';
import { createLogger } from '../logger.js';

const logger = createLogger('CalendarHttpClient');

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
   * Make a PROPFIND request to get calendar properties
   * @param data XML data for the request
   * @param depth Depth of the request (0, 1, or infinity)
   * @returns The response data
   */
  async propfind(data: string, depth: string = '1'): Promise<string> {
    try {
      logger.debug('Making PROPFIND request to Nextcloud CalDAV');

      const response = await axios({
        method: 'PROPFIND',
        url: this.caldavUrl,
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
      const calendarUrl = this.caldavUrl + calendarId + '/';
      logger.debug(`Making MKCALENDAR request for calendar ${calendarId}`);

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
      const calendarUrl = this.caldavUrl + calendarId + '/';
      logger.debug(`Making PROPPATCH request for calendar ${calendarId}`);

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
      const calendarUrl = this.caldavUrl + calendarId + '/';
      logger.debug(`Making DELETE request for calendar ${calendarId}`);

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
      const calendarUrl = this.caldavUrl + calendarId + '/';
      logger.debug(`Making REPORT request for calendar ${calendarId}`);

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
    const eventUrl = this.caldavUrl + calendarId + '/' + eventId + '.ics';
    const isUpdate = etag ? true : false;
    const logAction = isUpdate ? 'update' : 'create';

    logger.debug(`Making PUT request to ${logAction} event ${eventId} in calendar ${calendarId}`);

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
      logger.error(`PUT request failed to ${logAction} event ${eventId}:`, error);
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
      const eventUrl = this.caldavUrl + calendarId + '/' + eventId + '.ics';
      logger.debug(`Making DELETE request for event ${eventId} in calendar ${calendarId}`);

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
   * @returns Error with meaningful message
   */
  private handleHttpError(error: unknown, defaultMessage: string): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;

      // Handle common HTTP errors with more specific messages
      if (status === 401 || status === 403) {
        return new Error('Unauthorized: You do not have permission for this action.');
      } else if (status === 404) {
        return new Error('Resource not found.');
      } else if (status === 405) {
        return new Error('Operation not supported by this server.');
      } else if (status === 409) {
        return new Error('Conflict: Resource already exists or contains conflicts.');
      } else if (status === 412) {
        return new Error(
          'Precondition Failed: The resource was modified by another client. Please refresh and try again.',
        );
      } else if (status === 423) {
        return new Error('Resource is locked and cannot be modified.');
      } else if (status === 507) {
        return new Error('Insufficient storage space.');
      }
    }

    // Generic error for unknown cases
    return new Error(defaultMessage);
  }
}
