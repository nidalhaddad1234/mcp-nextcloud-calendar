/**
 * Service for handling Nextcloud calendar events via CalDAV
 */
import { NextcloudConfig } from '../../config/config.js';
import { Event } from '../../models/index.js';
import { createLogger } from '../logger.js';
import { CalendarHttpClient, CalDavError } from './http-client.js';
import * as XmlUtils from './xml-utils.js';
import * as iCalUtils from './ical-utils.js';
import crypto from 'crypto';

export class EventService {
  private config: NextcloudConfig;
  private httpClient: CalendarHttpClient;
  private logger = createLogger('EventService');

  constructor(config: NextcloudConfig) {
    this.config = config;

    if (!this.config.baseUrl || !this.config.username || !this.config.appToken) {
      throw new Error('Nextcloud configuration is incomplete');
    }

    // Remove trailing slash if present
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');

    // Initialize HTTP client
    this.httpClient = new CalendarHttpClient(baseUrl, this.config.username, this.config.appToken);

    // Log initialization without sensitive details
    this.logger.info('EventService initialized successfully', {
      baseUrl: baseUrl,
      username: this.config.username,
    });
  }

  /**
   * Get events from a calendar with optional filtering
   * @param calendarId ID of the calendar to get events from
   * @param options Optional filtering parameters
   * @returns Promise<Event[]> List of events
   */
  async getEvents(
    calendarId: string,
    options?: {
      start?: Date;
      end?: Date;
      limit?: number;
      expandRecurring?: boolean;
      priorityMinimum?: number;
      adhdCategory?: string;
      tags?: string[];
    },
  ): Promise<Event[]> {
    this.logger.debug(`Fetching events for calendar ${calendarId}`, options);

    try {
      // Validate calendar ID
      if (!calendarId) {
        throw new Error('Calendar ID is required');
      }

      // Build the REPORT request for calendar events
      const reportXml = XmlUtils.buildEventsReportRequest(options?.start, options?.end);

      // Send the REPORT request
      const reportResponse = await this.httpClient.calendarReport(calendarId, reportXml);

      // Parse the XML response
      const xmlData = await XmlUtils.parseXmlResponse(reportResponse);

      // Extract events from the response
      const events: Event[] = [];
      const multistatus = XmlUtils.getMultistatus(xmlData);

      if (multistatus) {
        const responses = XmlUtils.getResponses(multistatus);

        for (const response of responses) {
          try {
            // Get the href (event URL)
            const href = response['d:href'];

            if (!href) {
              continue;
            }

            // Find successful propstat
            const propstat = Array.isArray(response['d:propstat'])
              ? response['d:propstat'].find(
                  (ps: { 'd:status'?: string }) => ps['d:status'] === 'HTTP/1.1 200 OK',
                )
              : response['d:propstat'];

            if (!propstat || !propstat['d:prop']) {
              continue;
            }

            const prop = propstat['d:prop'];

            // Get the calendar data (iCalendar format)
            const calendarData = prop['c:calendar-data'] || prop['calendar-data'];

            if (!calendarData) {
              continue;
            }

            // Parse the iCalendar data
            const parsedEvents = iCalUtils.parseICalEvents(calendarData.toString(), calendarId);

            // Add to our list of events
            events.push(...parsedEvents);
          } catch (parseError) {
            this.logger.warn('Error parsing event response:', parseError);
          }
        }
      }

      // Handle recurring events expansion if requested
      let processedEvents = events;
      if (options?.expandRecurring && processedEvents.some((event) => event.recurrenceRule)) {
        this.logger.debug('Expanding recurring events');

        try {
          processedEvents = await this.expandRecurringEvents(
            processedEvents,
            calendarId,
            options?.start,
            options?.end,
          );
        } catch (expansionError) {
          this.logger.warn('Error expanding recurring events:', expansionError);
          // Continue with unexpanded events if expansion fails
        }
      }

      // Apply client-side filtering
      // TODO: For better performance with large calendars, consider implementing server-side
      // filtering where possible by modifying the REPORT request's XML. CalDAV supports
      // filtering by property through comp-filter and prop-filter elements. This would be
      // particularly important for date ranges, categories, and other standard properties.
      // Currently, we fetch all events and filter client-side, which may not be efficient
      // for calendars with many events.
      let filteredEvents = processedEvents;

      // Filter by ADHD category if specified
      if (options?.adhdCategory) {
        filteredEvents = filteredEvents.filter(
          (event) => event.adhdCategory === options.adhdCategory,
        );
      }

      // Filter by minimum priority if specified
      if (options?.priorityMinimum !== undefined) {
        filteredEvents = filteredEvents.filter(
          (event) =>
            event.focusPriority !== undefined &&
            event.focusPriority >= (options.priorityMinimum as number),
        );
      }

      // Filter by tags if specified
      if (options?.tags && options.tags.length > 0) {
        filteredEvents = filteredEvents.filter((event) => {
          // Check if categories exist before using some()
          if (!event.categories || !Array.isArray(event.categories)) {
            return false;
          }
          // Now safely check if any of the requested tags match
          // We've already verified that event.categories exists and is an array
          return options.tags?.some((tag) => (event.categories as string[]).includes(tag));
        });
      }

      // Limit the number of results if specified
      if (options?.limit && options.limit > 0 && filteredEvents.length > options.limit) {
        filteredEvents = filteredEvents.slice(0, options.limit);
      }

      this.logger.info(`Retrieved ${filteredEvents.length} events from calendar ${calendarId}`);
      return filteredEvents;
    } catch (error) {
      this.logger.error(`Error fetching events for calendar ${calendarId}:`, error);
      throw new Error(`Failed to fetch events: ${(error as Error).message}`);
    }
  }

  /**
   * Get a specific event by ID
   * @param calendarId ID of the calendar containing the event
   * @param eventId ID of the event to retrieve
   * @returns Promise<Event> The requested event
   */
  async getEventById(calendarId: string, eventId: string): Promise<Event> {
    this.logger.debug(`Fetching event ${eventId} from calendar ${calendarId}`);

    try {
      // Validate input
      if (!calendarId) {
        throw new Error('Calendar ID is required');
      }

      if (!eventId) {
        throw new Error('Event ID is required');
      }

      // First approach: Try direct GET request to the event URL
      const eventUrl = `${this.httpClient.getCalDavUrl()}${calendarId}/${eventId}.ics`;

      try {
        // Attempt to fetch the event directly
        const iCalData = await this.httpClient.getEvent(eventUrl);

        // Parse the iCalendar data
        const events = iCalUtils.parseICalEvents(iCalData, calendarId);

        if (events.length > 0) {
          return events[0];
        }
      } catch (directFetchError) {
        this.logger.warn(
          `Direct fetch for event ${eventId} failed, trying REPORT approach`,
          directFetchError,
        );
        // Continue to alternative approach if direct fetch fails
      }

      // Second approach: Use REPORT with UID filter
      const reportXml = XmlUtils.buildEventByUidRequest(eventId);

      // Send the REPORT request
      const reportResponse = await this.httpClient.calendarReport(calendarId, reportXml);

      // Parse the XML response
      const xmlData = await XmlUtils.parseXmlResponse(reportResponse);

      // Extract the event from the response
      const multistatus = XmlUtils.getMultistatus(xmlData);

      if (multistatus) {
        const responses = XmlUtils.getResponses(multistatus);

        for (const response of responses) {
          try {
            // Find successful propstat
            const propstat = Array.isArray(response['d:propstat'])
              ? response['d:propstat'].find(
                  (ps: { 'd:status'?: string }) => ps['d:status'] === 'HTTP/1.1 200 OK',
                )
              : response['d:propstat'];

            if (!propstat || !propstat['d:prop']) {
              continue;
            }

            const prop = propstat['d:prop'];

            // Get the calendar data (iCalendar format)
            const calendarData = prop['c:calendar-data'] || prop['calendar-data'];

            if (!calendarData) {
              continue;
            }

            // Parse the iCalendar data
            const events = iCalUtils.parseICalEvents(calendarData.toString(), calendarId);

            // Find the event with the matching ID
            const event = events.find((e) => e.id === eventId);

            if (event) {
              return event;
            }
          } catch (parseError) {
            this.logger.warn('Error parsing event response:', parseError);
          }
        }
      }

      // If we get here, the event was not found
      throw new Error(`Event with ID ${eventId} not found in calendar ${calendarId}`);
    } catch (error) {
      this.logger.error(`Error fetching event ${eventId} from calendar ${calendarId}:`, error);
      throw new Error(`Failed to fetch event: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new event in a calendar
   * @param calendarId ID of the calendar to add the event to
   * @param event Event object with properties for the new event
   * @returns Promise<Event> The created event with server-assigned properties
   */
  async createEvent(
    calendarId: string,
    event: Omit<Event, 'id' | 'created' | 'lastModified'>,
  ): Promise<Event> {
    this.logger.debug(`Creating new event in calendar ${calendarId}`);

    try {
      // Validate input
      if (!calendarId) {
        throw new Error('Calendar ID is required');
      }

      if (!event.title) {
        throw new Error('Event title is required');
      }

      if (!event.start || !event.end) {
        throw new Error('Event start and end dates are required');
      }

      // Generate a unique ID for the event
      const uuid = crypto.randomUUID();
      const eventId = uuid.replace(/-/g, '');

      // Create a complete event object
      const now = new Date();
      const completeEvent: Event = {
        id: eventId,
        calendarId: calendarId,
        title: event.title,
        description: event.description,
        start: event.start,
        end: event.end,
        isAllDay: event.isAllDay || false,
        location: event.location,
        organizer: event.organizer,
        participants: event.participants,
        recurrenceRule: event.recurrenceRule,
        status: event.status,
        visibility: event.visibility,
        availability: event.availability,
        reminders: event.reminders,
        color: event.color,
        categories: event.categories,
        adhdCategory: event.adhdCategory,
        focusPriority: event.focusPriority,
        energyLevel: event.energyLevel,
        relatedTasks: event.relatedTasks,
        created: now,
        lastModified: now,
        metadata: event.metadata,
      };

      // Generate iCalendar data
      const iCalData = iCalUtils.generateICalEvent(completeEvent);

      // Create the event via PUT request
      const success = await this.httpClient.putEvent(calendarId, eventId, iCalData);

      if (!success) {
        throw new Error('Failed to create event, server did not acknowledge successful creation');
      }

      // Return the complete event object
      this.logger.info(`Event ${eventId} created successfully in calendar ${calendarId}`);
      return completeEvent;
    } catch (error) {
      this.logger.error(`Error creating event in calendar ${calendarId}:`, error);
      throw new Error(`Failed to create event: ${(error as Error).message}`);
    }
  }

  /**
   * Update an existing event
   * @param calendarId ID of the calendar containing the event
   * @param eventId ID of the event to update
   * @param updates Partial event object with updated properties
   * @returns Promise<Event> The updated event
   */
  async updateEvent(calendarId: string, eventId: string, updates: Partial<Event>): Promise<Event> {
    this.logger.debug(`Updating event ${eventId} in calendar ${calendarId}`);

    try {
      // Validate input
      if (!calendarId) {
        throw new Error('Calendar ID is required');
      }

      if (!eventId) {
        throw new Error('Event ID is required');
      }

      if (!updates || Object.keys(updates).length === 0) {
        throw new Error('No updates provided');
      }

      // Fetch the existing event
      const currentEvent = await this.getEventById(calendarId, eventId);

      if (!currentEvent) {
        throw new Error(`Event ${eventId} not found in calendar ${calendarId}`);
      }

      // Merge the updates with the current event
      const updatedEvent: Event = {
        ...currentEvent,
        ...updates,
        id: eventId, // Ensure ID doesn't change
        calendarId: calendarId, // Ensure calendar doesn't change
        lastModified: new Date(), // Update the modification timestamp
      };

      // We need to fetch the event's ETag to avoid conflicts
      // This involves making a direct request to the event URL
      const eventUrl = `${this.httpClient.getCalDavUrl()}${calendarId}/${eventId}.ics`;
      let etag = '';

      try {
        // Make a HEAD request to get the ETag using the httpClient instead of direct axios
        const response = await this.httpClient.getEventEtag(eventUrl);
        etag = response || '';
      } catch (etagError) {
        this.logger.warn(
          `Failed to fetch ETag for event ${eventId}, proceeding without optimistic concurrency control`,
          etagError,
        );
      }

      // Generate iCalendar data
      const iCalData = iCalUtils.generateICalEvent(updatedEvent);

      // Update the event via PUT request
      let success: boolean;

      if (etag) {
        success = await this.httpClient.updateEvent(calendarId, eventId, iCalData, etag);
      } else {
        // Fallback without ETag
        success = await this.httpClient.putEvent(calendarId, eventId, iCalData);
      }

      if (!success) {
        throw new Error('Failed to update event, server did not acknowledge successful update');
      }

      // Return the updated event object
      this.logger.info(`Event ${eventId} updated successfully in calendar ${calendarId}`);
      return updatedEvent;
    } catch (error) {
      this.logger.error(`Error updating event ${eventId} in calendar ${calendarId}:`, error);

      // Check for optimistic concurrency failures using the CalDavError type
      if (error instanceof CalDavError && error.isOptimisticConcurrencyFailure) {
        throw new Error(
          `The event was modified by another user. Please refresh the event data and try again.`,
        );
      }

      throw new Error(`Failed to update event: ${(error as Error).message}`);
    }
  }

  /**
   * Expand recurring events within a date range
   * @param events List of events to check for recurring events
   * @param calendarId ID of the calendar containing the events
   * @param start Optional start date for expansion
   * @param end Optional end date for expansion
   * @returns Promise<Event[]> List of events with recurring instances expanded
   */
  private async expandRecurringEvents(
    events: Event[],
    calendarId: string,
    start?: Date,
    end?: Date,
  ): Promise<Event[]> {
    // Default dates if not provided
    const startDate = start || new Date();
    const endDate = end || new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000); // Default to 90 days ahead

    this.logger.debug(
      `Expanding recurring events from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Filter the events to find those with recurrence rules
    const recurringEvents = events.filter((event) => event.recurrenceRule);

    if (recurringEvents.length === 0) {
      // No recurring events to expand
      return events;
    }

    // Create a list of event URLs to fetch for the multiget request
    const eventUrls: string[] = recurringEvents.map(
      (event) => `${this.httpClient.getCalDavUrl()}${calendarId}/${event.id}.ics`,
    );

    // Build the XML request for expanding recurring events
    const expandXml = XmlUtils.buildExpandRecurringEventsRequest(eventUrls, startDate, endDate);

    try {
      // Send the REPORT request
      const reportResponse = await this.httpClient.calendarReport(calendarId, expandXml);

      // Parse the XML response
      const xmlData = await XmlUtils.parseXmlResponse(reportResponse);

      // Extract expanded events from the response
      const expandedEvents: Event[] = [];
      const multistatus = XmlUtils.getMultistatus(xmlData);

      if (multistatus) {
        const responses = XmlUtils.getResponses(multistatus);

        for (const response of responses) {
          try {
            // Find successful propstat
            const propstat = Array.isArray(response['d:propstat'])
              ? response['d:propstat'].find(
                  (ps: { 'd:status'?: string }) => ps['d:status'] === 'HTTP/1.1 200 OK',
                )
              : response['d:propstat'];

            if (!propstat || !propstat['d:prop']) {
              continue;
            }

            const prop = propstat['d:prop'];

            // Get the calendar data (iCalendar format)
            const calendarData = prop['c:calendar-data'] || prop['calendar-data'];

            if (!calendarData) {
              continue;
            }

            // Parse the iCalendar data to get expanded instances
            const parsedEvents = iCalUtils.parseICalEvents(calendarData.toString(), calendarId);

            // Add to our list of expanded events
            expandedEvents.push(...parsedEvents);
          } catch (parseError) {
            this.logger.warn('Error parsing expanded event response:', parseError);
          }
        }
      }

      // Now merge the expanded events with the non-recurring events
      const nonRecurringEvents = events.filter((event) => !event.recurrenceRule);
      const mergedEvents = [...nonRecurringEvents, ...expandedEvents];

      this.logger.info(
        `Expanded ${recurringEvents.length} recurring events into ${expandedEvents.length} instances`,
      );
      return mergedEvents;
    } catch (error) {
      this.logger.error('Error expanding recurring events:', error);
      throw new Error(`Failed to expand recurring events: ${(error as Error).message}`);
    }
  }

  /**
   * Delete an event from a calendar
   * @param calendarId ID of the calendar containing the event
   * @param eventId ID of the event to delete
   * @returns Promise<boolean> True if event was deleted successfully
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<boolean> {
    this.logger.debug(`Deleting event ${eventId} from calendar ${calendarId}`);

    try {
      // Validate input
      if (!calendarId) {
        throw new Error('Calendar ID is required');
      }

      if (!eventId) {
        throw new Error('Event ID is required');
      }

      // Verify the event exists before attempting to delete it
      try {
        await this.getEventById(calendarId, eventId);
      } catch (error) {
        // If the event doesn't exist, log a warning but don't fail (idempotent delete)
        if ((error as Error).message.includes('not found')) {
          this.logger.warn(
            `Event ${eventId} not found in calendar ${calendarId}, treating delete as success`,
          );
          return true;
        }
        // Re-throw any other errors
        throw error;
      }

      // Delete the event via DELETE request
      const success = await this.httpClient.deleteEvent(calendarId, eventId);

      if (!success) {
        throw new Error('Failed to delete event, server did not acknowledge successful deletion');
      }

      this.logger.info(`Event ${eventId} deleted successfully from calendar ${calendarId}`);
      return true;
    } catch (error) {
      // Special case: if the error is that the event wasn't found, treat as success
      if ((error as Error).message.includes('not found')) {
        this.logger.warn(`Event ${eventId} was already deleted, treating as success`);
        return true;
      }

      this.logger.error(`Error deleting event ${eventId} from calendar ${calendarId}:`, error);
      throw new Error(`Failed to delete event: ${(error as Error).message}`);
    }
  }
}
