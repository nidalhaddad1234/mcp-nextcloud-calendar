/**
 * Service for handling Nextcloud calendar events via CalDAV - Enhanced Version
 */
import { NextcloudConfig } from '../../config/config.js';
import { Event } from '../../models/index.js';
import { createLogger } from '../logger.js';
import { XmlService, CalDavXmlBuilder } from '../xml/index.js';
import { EnhancedXmlService } from '../xml/enhanced-xml-service.js';
import { EnhancedICalParser } from './enhanced-ical-utils.js';
import { CalendarHttpClient, CalDavError } from './http-client.js';
import { TimezoneService } from '../timezone-service.js';

import crypto from 'crypto';

export class EventService {
  private config: NextcloudConfig;
  private httpClient: CalendarHttpClient;
  private logger = createLogger('EventService');
  private xmlService: XmlService;
  private enhancedXmlService: EnhancedXmlService;
  private caldavXmlBuilder: CalDavXmlBuilder;
  private timezoneService: TimezoneService;

  constructor(config: NextcloudConfig) {
    this.config = config;

    if (!this.config.baseUrl || !this.config.username || !this.config.appToken) {
      throw new Error('Nextcloud configuration is incomplete');
    }

    // Remove trailing slash if present
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');

    // Initialize HTTP client
    this.httpClient = new CalendarHttpClient(baseUrl, this.config.username, this.config.appToken);

    // Initialize XML services
    this.xmlService = new XmlService();
    this.enhancedXmlService = new EnhancedXmlService();
    this.caldavXmlBuilder = new CalDavXmlBuilder(this.xmlService);

    // Initialize timezone service with user preferences
    this.timezoneService = new TimezoneService(
      this.config.defaultTimezone || 'Europe/Paris',
      this.config.useLocalTimezone !== false,
    );

    // Log initialization without sensitive details
    this.logger.info('EventService initialized successfully', {
      baseUrl: baseUrl,
      username: this.config.username,
      timezone: this.timezoneService.getTimezoneInfo().timezone,
    });
  }

  /**
   * Enhance an event with timezone-aware formatting
   * @param event The event to enhance
   * @returns Event with additional timezone-aware properties
   * @private Internal utility method
   */
  private enhanceEventWithTimezone(event: Event): Event & {
    localStart: Date;
    localEnd: Date;
    formattedDateRange: string;
    readableStart: string;
    readableEnd: string;
  } {
    const localStart = this.timezoneService.toLocal(event.start);
    const localEnd = this.timezoneService.toLocal(event.end);

    return {
      ...event,
      localStart,
      localEnd,
      formattedDateRange: this.timezoneService.formatDateRange(
        localStart,
        localEnd,
        event.isAllDay,
      ),
      readableStart: event.isAllDay
        ? this.timezoneService.formatAllDay(localStart)
        : this.timezoneService.formatAsReadable(localStart),
      readableEnd: event.isAllDay
        ? this.timezoneService.formatAllDay(localEnd)
        : this.timezoneService.formatAsReadable(localEnd),
    };
  }

  /**
   * Validate a calendar ID
   * @param calendarId The calendar ID to validate
   * @throws Error if the calendar ID is invalid
   * @private Internal utility method
   */
  private validateCalendarId(calendarId: string): void {
    if (!calendarId) {
      throw new Error('Calendar ID is required');
    }

    // Calendar IDs should follow a specific format:
    // - Only alphanumeric characters, hyphens, underscores, and periods
    // - Cannot contain path traversal sequences
    const safeIdRegex = /^[a-zA-Z0-9_.-]+$/;

    if (!safeIdRegex.test(calendarId)) {
      this.logger.error(`Invalid calendar ID format: ${calendarId}`);
      throw new Error(
        'Invalid calendar ID format: Only alphanumeric characters, dash, underscore, and period are allowed',
      );
    }
  }

  /**
   * Validate an event ID
   * @param eventId The event ID to validate
   * @throws Error if the event ID is invalid
   * @private Internal utility method
   */
  private validateEventId(eventId: string): void {
    if (!eventId) {
      throw new Error('Event ID is required');
    }

    // Event IDs should be safe for use in URLs
    const safeIdRegex = /^[a-zA-Z0-9_.-]+$/;

    if (!safeIdRegex.test(eventId)) {
      this.logger.error(`Invalid event ID format: ${eventId}`);
      throw new Error(
        'Invalid event ID format: Only alphanumeric characters, dash, underscore, and period are allowed',
      );
    }
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
      this.validateCalendarId(calendarId);

      // Create time range for the calendar query
      const timeRange =
        options?.start && options?.end ? { start: options.start, end: options.end } : undefined;

      // Build the REPORT request for calendar events
      const reportXml = this.caldavXmlBuilder.buildCalendarQueryReport(timeRange);

      this.logger.debug('Sending CalDAV REPORT request', { calendarId, timeRange });

      // Send the REPORT request
      const reportResponse = await this.httpClient.calendarReport(calendarId, reportXml);

      this.logger.debug('Received CalDAV REPORT response, parsing...');

      // Parse the XML response using enhanced parser
      const xmlData = await this.enhancedXmlService.parseCalDAVResponse(reportResponse);

      // Extract events from the response using enhanced parser
      const events: Event[] = [];
      const responses = this.enhancedXmlService.extractMultistatusResponses(xmlData);

      this.logger.debug(`Processing ${responses.length} CalDAV responses`);

      for (const response of responses) {
        try {
          // Get the href (event URL)
          const href = response.href;

          if (!href) {
            this.logger.debug('Skipping response with no href');
            continue;
          }

          // Get calendar data from properties using enhanced extractor
          const calendarData = this.enhancedXmlService.extractCalendarData(response.properties);

          if (!calendarData) {
            this.logger.debug('Skipping response with no calendar data', { href });
            continue;
          }

          this.logger.debug('Parsing iCalendar data for event', { href });

          // Parse the iCalendar data using enhanced parser
          const parsedEvents = EnhancedICalParser.parseICalEvents(calendarData, calendarId);

          // Add to our list of events
          events.push(...parsedEvents);
        } catch (parseError) {
          this.logger.warn('Error parsing event response:', parseError);
        }
      }

      this.logger.info(`Successfully fetched ${events.length} events from calendar ${calendarId}`);

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
          (event) => (event.focusPriority || 0) >= (options.priorityMinimum || 0),
        );
      }

      // Filter by tags if specified
      if (options?.tags && options.tags.length > 0) {
        filteredEvents = filteredEvents.filter((event) =>
          options.tags!.some((tag) => event.categories?.includes(tag)),
        );
      }

      // Apply limit if specified
      if (options?.limit) {
        filteredEvents = filteredEvents.slice(0, options.limit);
      }

      this.logger.debug(`Returning ${filteredEvents.length} filtered events`);
      return filteredEvents;
    } catch (error) {
      this.logger.error(`Error fetching events from calendar ${calendarId}:`, error);
      throw new Error(`Failed to fetch events: ${(error as Error).message}`);
    }
  }

  /**
   * Get a specific event by ID
   * @param calendarId ID of the calendar containing the event
   * @param eventId ID of the event to fetch
   * @returns Promise<Event> The requested event
   */
  async getEventById(calendarId: string, eventId: string): Promise<Event> {
    this.logger.debug(`Fetching event ${eventId} from calendar ${calendarId}`);

    try {
      // Validate input
      this.validateCalendarId(calendarId);
      this.validateEventId(eventId);

      // Construct the event URL
      const eventUrl = `${this.httpClient.getCalDavUrl()}${calendarId}/${eventId}.ics`;

      // Fetch the event directly
      const iCalData = await this.httpClient.getEvent(eventUrl);

      // Parse the iCalendar data using enhanced parser
      const events = EnhancedICalParser.parseICalEvents(iCalData, calendarId);

      if (events.length === 0) {
        throw new Error(`Event with ID ${eventId} not found in calendar ${calendarId}`);
      }

      // Return the first (and should be only) event
      const event = events[0];
      this.logger.debug(`Successfully fetched event ${eventId} from calendar ${calendarId}`);
      return event;
    } catch (error) {
      if (
        (error as Error).message.includes('not found') ||
        (error as Error).message.includes('404')
      ) {
        throw new Error(`Event with ID ${eventId} not found in calendar ${calendarId}`);
      }
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
      this.validateCalendarId(calendarId);

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

      // Generate iCalendar data using enhanced generator
      const iCalData = EnhancedICalParser.generateICalEvent(completeEvent);

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
      this.validateCalendarId(calendarId);
      this.validateEventId(eventId);

      // Fetch the current event to get existing data
      const currentEvent = await this.getEventById(calendarId, eventId);

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

      // Generate iCalendar data using enhanced generator
      const iCalData = EnhancedICalParser.generateICalEvent(updatedEvent);

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
    // Validate calendar ID
    this.validateCalendarId(calendarId);

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
    const expandXml = this.caldavXmlBuilder.buildExpandRecurringEventsRequest(
      eventUrls,
      startDate,
      endDate,
    );

    try {
      // Send the REPORT request
      const reportResponse = await this.httpClient.calendarReport(calendarId, expandXml);

      // Parse the XML response using enhanced parser
      const xmlData = await this.enhancedXmlService.parseCalDAVResponse(reportResponse);

      // Extract expanded events from the response
      const expandedEvents: Event[] = [];
      const responses = this.enhancedXmlService.extractMultistatusResponses(xmlData);

      for (const response of responses) {
        try {
          // Get calendar data from properties using enhanced extractor
          const calendarData = this.enhancedXmlService.extractCalendarData(response.properties);

          if (!calendarData) {
            continue;
          }

          // Parse the iCalendar data to get expanded instances using enhanced parser
          const parsedEvents = EnhancedICalParser.parseICalEvents(calendarData, calendarId);

          // Add to our list of expanded events
          expandedEvents.push(...parsedEvents);
        } catch (parseError) {
          this.logger.warn('Error parsing expanded event response:', parseError);
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
      this.validateCalendarId(calendarId);
      this.validateEventId(eventId);

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
