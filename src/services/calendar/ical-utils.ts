/**
 * Utilities for handling iCalendar format data
 */
import { Event, RecurrenceRule, EventReminder } from '../../models/index.js';
import { createLogger } from '../logger.js';
import * as crypto from 'crypto';

const logger = createLogger('iCalUtils');

/**
 * Extract events from an iCalendar string
 * @param iCalData The iCalendar data in string format
 * @param calendarId The ID of the calendar containing the events
 * @returns An array of Event objects
 */
export function parseICalEvents(iCalData: string, calendarId: string): Event[] {
  try {
    logger.debug('Parsing iCalendar data');

    const events: Event[] = [];

    // NOTE: This is a simplified parser for demonstration
    // In a production environment, we would use a proper iCalendar library
    // such as ical.js or node-ical

    // Split the iCalendar data into components
    const components = splitICalComponents(iCalData);

    // Find all VEVENT components
    components.forEach((component) => {
      if (component.startsWith('BEGIN:VEVENT') && component.endsWith('END:VEVENT')) {
        try {
          const event = parseEventComponent(component, calendarId);
          if (event) {
            events.push(event);
          }
        } catch (parseError) {
          logger.warn('Error parsing event component:', parseError);
        }
      }
    });

    logger.debug(`Parsed ${events.length} events from iCalendar data`);
    return events;
  } catch (err) {
    logger.error('Error parsing iCalendar data:', err);
    throw new Error(`Failed to parse iCalendar data: ${(err as Error).message}`);
  }
}

/**
 * Generate an iCalendar string from an Event object
 * @param event The Event object to convert to iCalendar format
 * @returns An iCalendar string representing the event
 */
export function generateICalEvent(event: Event): string {
  try {
    logger.debug(`Generating iCalendar data for event ${event.id}`);

    // Format dates in the iCalendar format (YYYYMMDDTHHMMSSZ)
    const formatDate = (date: Date, isAllDay = false): string => {
      if (isAllDay) {
        return date.toISOString().substring(0, 10).replace(/-/g, '');
      } else {
        return date
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '');
      }
    };

    // Generate a unique ID if one doesn't exist
    const eventId = event.id || generateUid();

    // Build the iCalendar string
    let iCal = 'BEGIN:VCALENDAR\r\n';
    iCal += 'VERSION:2.0\r\n';
    iCal += 'PRODID:-//Nextcloud Calendar//EN\r\n';
    iCal += 'CALSCALE:GREGORIAN\r\n';

    // Event component
    iCal += 'BEGIN:VEVENT\r\n';
    iCal += `UID:${eventId}\r\n`;

    // Event created/modified timestamps
    iCal += `DTSTAMP:${formatDate(new Date())}\r\n`;
    if (event.created) {
      iCal += `CREATED:${formatDate(event.created)}\r\n`;
    }
    if (event.lastModified) {
      iCal += `LAST-MODIFIED:${formatDate(event.lastModified)}\r\n`;
    }

    // Event dates
    if (event.isAllDay) {
      iCal += `DTSTART;VALUE=DATE:${formatDate(event.start, true)}\r\n`;
      // For all-day events, the end date is exclusive
      const endDate = new Date(event.end);
      endDate.setDate(endDate.getDate() + 1);
      iCal += `DTEND;VALUE=DATE:${formatDate(endDate, true)}\r\n`;
    } else {
      iCal += `DTSTART:${formatDate(event.start)}\r\n`;
      iCal += `DTEND:${formatDate(event.end)}\r\n`;
    }

    // Event title and description
    iCal += `SUMMARY:${escapeICalString(event.title)}\r\n`;
    if (event.description) {
      iCal += `DESCRIPTION:${escapeICalString(event.description)}\r\n`;
    }

    // Location
    if (event.location) {
      iCal += `LOCATION:${escapeICalString(event.location)}\r\n`;
    }

    // Status
    if (event.status) {
      iCal += `STATUS:${event.status.toUpperCase()}\r\n`;
    }

    // Class (visibility)
    if (event.visibility) {
      let classValue: string;
      switch (event.visibility) {
        case 'private':
          classValue = 'PRIVATE';
          break;
        case 'confidential':
          classValue = 'CONFIDENTIAL';
          break;
        default:
          classValue = 'PUBLIC';
      }
      iCal += `CLASS:${classValue}\r\n`;
    }

    // Transparency (availability)
    if (event.availability) {
      iCal += `TRANSP:${event.availability === 'free' ? 'TRANSPARENT' : 'OPAQUE'}\r\n`;
    }

    // Organizer
    if (event.organizer) {
      iCal += `ORGANIZER:MAILTO:${event.organizer}\r\n`;
    }

    // Participants (attendees)
    if (event.participants && event.participants.length > 0) {
      event.participants.forEach((participant) => {
        let attendee = `ATTENDEE;CN=${escapeICalString(participant.name || participant.email)}`;

        // Role
        if (participant.role) {
          attendee += `;ROLE=${participant.role === 'required' ? 'REQ-PARTICIPANT' : 'OPT-PARTICIPANT'}`;
        }

        // Participation status
        if (participant.status) {
          let partstatValue: string;
          switch (participant.status) {
            case 'accepted':
              partstatValue = 'ACCEPTED';
              break;
            case 'declined':
              partstatValue = 'DECLINED';
              break;
            case 'tentative':
              partstatValue = 'TENTATIVE';
              break;
            default:
              partstatValue = 'NEEDS-ACTION';
          }
          attendee += `;PARTSTAT=${partstatValue}`;
        }

        // Type
        if (participant.type) {
          attendee += `;CUTYPE=${participant.type.toUpperCase()}`;
        }

        attendee += `:MAILTO:${participant.email}\r\n`;
        iCal += attendee;
      });
    }

    // Categories
    if (event.categories && event.categories.length > 0) {
      iCal += `CATEGORIES:${event.categories.map(escapeICalString).join(',')}\r\n`;
    }

    // Color
    if (event.color) {
      // X-APPLE-CALENDAR-COLOR is a common extension for calendar color
      iCal += `X-APPLE-CALENDAR-COLOR:${event.color}\r\n`;
    }

    // ADHD-specific properties (using X- prefixed custom properties)
    if (event.adhdCategory) {
      iCal += `X-ADHD-CATEGORY:${escapeICalString(event.adhdCategory)}\r\n`;
    }

    if (event.focusPriority !== undefined) {
      iCal += `X-ADHD-FOCUS-PRIORITY:${event.focusPriority}\r\n`;
    }

    if (event.energyLevel !== undefined) {
      iCal += `X-ADHD-ENERGY-LEVEL:${event.energyLevel}\r\n`;
    }

    // Related tasks
    if (event.relatedTasks && event.relatedTasks.length > 0) {
      event.relatedTasks.forEach((task) => {
        iCal += `X-ADHD-RELATED-TASK:${escapeICalString(task)}\r\n`;
      });
    }

    // Recurrence rule
    if (event.recurrenceRule) {
      iCal += generateRecurrenceRule(event.recurrenceRule);
    }

    // Alarms (reminders)
    if (event.reminders && event.reminders.length > 0) {
      event.reminders.forEach((reminder) => {
        iCal += generateAlarm(reminder);
      });
    }

    iCal += 'END:VEVENT\r\n';
    iCal += 'END:VCALENDAR\r\n';

    return iCal;
  } catch (err) {
    logger.error('Error generating iCalendar data:', err);
    throw new Error(`Failed to generate iCalendar data: ${(err as Error).message}`);
  }
}

/**
 * Split an iCalendar string into its components
 * @param iCalData The iCalendar data
 * @returns Array of component strings
 */
function splitICalComponents(iCalData: string): string[] {
  const components: string[] = [];
  let currentComponent = '';
  let inComponent = false;
  let componentDepth = 0;
  let componentType = '';

  // Normalize line endings and split into lines
  const lines = iCalData.replace(/\r\n|\n\r|\n|\r/g, '\r\n').split('\r\n');

  for (const line of lines) {
    if (line.startsWith('BEGIN:')) {
      componentDepth++;

      if (componentDepth === 1) {
        // Start of a root component
        currentComponent = line;
        inComponent = true;
        componentType = line.substring(6); // Extract component type
      } else {
        // Nested component
        currentComponent += '\r\n' + line;
      }
    } else if (line.startsWith('END:')) {
      const endType = line.substring(4);

      if (componentDepth === 1 && endType === componentType) {
        // End of a root component
        currentComponent += '\r\n' + line;
        components.push(currentComponent);
        currentComponent = '';
        inComponent = false;
        componentDepth = 0;
        componentType = '';
      } else {
        // End of a nested component
        currentComponent += '\r\n' + line;
        componentDepth--;
      }
    } else if (inComponent) {
      // Part of the current component
      currentComponent += '\r\n' + line;
    }
  }

  return components;
}

/**
 * Parse a VEVENT component into an Event object
 * @param eventData The VEVENT component string
 * @param calendarId The ID of the calendar containing the event
 * @returns An Event object or null if parsing fails
 */
function parseEventComponent(eventData: string, calendarId: string): Event | null {
  try {
    // Split into lines and create a property map
    const lines = eventData.split('\r\n').filter((line) => line.trim() !== '');
    const props: Record<string, string> = {};

    // Parse each line
    lines.forEach((line) => {
      if (!line.includes(':')) return;

      // Handle property parameters like DTSTART;VALUE=DATE:
      const colonPos = line.indexOf(':');
      let propName = line.substring(0, colonPos);
      const propValue = line.substring(colonPos + 1);

      // Extract base property name if it has parameters
      const semiPos = propName.indexOf(';');
      if (semiPos > 0) {
        propName = propName.substring(0, semiPos);
      }

      props[propName] = propValue;
    });

    // Extract basic properties
    const uid = props['UID'] || '';
    if (!uid) return null;

    const summary = props['SUMMARY'] || 'Untitled Event';

    // Parse dates
    let start: Date;
    let end: Date;
    let isAllDay = false;

    try {
      // Handle all-day events
      if (lines.some((line) => line.startsWith('DTSTART;VALUE=DATE:'))) {
        isAllDay = true;
        const startDate = lines.find((line) => line.startsWith('DTSTART'))?.split(':')[1];
        const endDate = lines.find((line) => line.startsWith('DTEND'))?.split(':')[1];

        if (!startDate) {
          throw new DateParsingError('Start date is required for event');
        }

        start = parseICalDate(startDate);

        if (!endDate) {
          // If no end date provided, default to same as start date
          end = new Date(start);
        } else {
          // For all-day events, the end date is exclusive
          end = parseICalDate(endDate);
          end.setDate(end.getDate() - 1);
        }
      } else {
        // Regular events with time
        const startTime = props['DTSTART'];
        const endTime = props['DTEND'];

        if (!startTime) {
          throw new DateParsingError('Start time is required for event');
        }

        start = parseICalDateTime(startTime);

        if (!endTime) {
          // If no end time provided, default to 1 hour after start
          end = new Date(start);
          end.setHours(end.getHours() + 1);
        } else {
          end = parseICalDateTime(endTime);
        }
      }
    } catch (error) {
      // If we couldn't parse the dates, log error and return null
      if (error instanceof DateParsingError) {
        logger.warn(`Failed to parse event dates: ${error.message}`);
      } else {
        logger.warn(`Failed to parse event dates: ${(error as Error).message}`);
      }
      return null;
    }

    // Parse creation/modification dates
    let created: Date;
    let lastModified: Date;

    try {
      if (props['CREATED']) {
        created = parseICalDateTime(props['CREATED']);
      } else {
        created = new Date();
      }

      if (props['LAST-MODIFIED']) {
        lastModified = parseICalDateTime(props['LAST-MODIFIED']);
      } else {
        lastModified = new Date();
      }
    } catch (error) {
      // If parsing fails, use current date/time
      logger.warn(`Failed to parse created/modified dates: ${(error as Error).message}`);
      created = new Date();
      lastModified = new Date();
    }

    // Create basic event
    const event: Event = {
      id: uid,
      calendarId: calendarId,
      title: unescapeICalString(summary),
      description: props['DESCRIPTION'] ? unescapeICalString(props['DESCRIPTION']) : undefined,
      start: start,
      end: end,
      isAllDay: isAllDay,
      location: props['LOCATION'] ? unescapeICalString(props['LOCATION']) : undefined,
      organizer: props['ORGANIZER'] ? extractEmailFromCalAddress(props['ORGANIZER']) : undefined,
      created: created,
      lastModified: lastModified,
    };

    // Status
    if (props['STATUS']) {
      const status = props['STATUS'].toLowerCase();
      if (status === 'confirmed' || status === 'tentative' || status === 'cancelled') {
        event.status = status as 'confirmed' | 'tentative' | 'cancelled';
      }
    }

    // Visibility (CLASS)
    if (props['CLASS']) {
      const visibility = props['CLASS'].toLowerCase();
      if (visibility === 'public' || visibility === 'private' || visibility === 'confidential') {
        event.visibility = visibility as 'public' | 'private' | 'confidential';
      }
    }

    // Availability (TRANSP)
    if (props['TRANSP']) {
      event.availability = props['TRANSP'] === 'TRANSPARENT' ? 'free' : 'busy';
    }

    // Categories
    if (props['CATEGORIES']) {
      event.categories = props['CATEGORIES'].split(',').map(unescapeICalString);
    }

    // Custom ADHD properties
    const adhdProps: Record<string, string[]> = {};

    lines.forEach((line) => {
      if (line.startsWith('X-ADHD-')) {
        const colonPos = line.indexOf(':');
        if (colonPos > 0) {
          const propName = line.substring(0, colonPos);
          const propValue = line.substring(colonPos + 1);

          if (!adhdProps[propName]) {
            adhdProps[propName] = [];
          }
          adhdProps[propName].push(propValue);
        }
      }
    });

    if (adhdProps['X-ADHD-CATEGORY'] && adhdProps['X-ADHD-CATEGORY'].length > 0) {
      event.adhdCategory = unescapeICalString(adhdProps['X-ADHD-CATEGORY'][0]);
    }

    if (adhdProps['X-ADHD-FOCUS-PRIORITY'] && adhdProps['X-ADHD-FOCUS-PRIORITY'].length > 0) {
      const priority = parseInt(adhdProps['X-ADHD-FOCUS-PRIORITY'][0], 10);
      if (!isNaN(priority) && priority >= 1 && priority <= 10) {
        event.focusPriority = priority;
      }
    }

    if (adhdProps['X-ADHD-ENERGY-LEVEL'] && adhdProps['X-ADHD-ENERGY-LEVEL'].length > 0) {
      const level = parseInt(adhdProps['X-ADHD-ENERGY-LEVEL'][0], 10);
      if (!isNaN(level) && level >= 1 && level <= 5) {
        event.energyLevel = level;
      }
    }

    if (adhdProps['X-ADHD-RELATED-TASK']) {
      event.relatedTasks = adhdProps['X-ADHD-RELATED-TASK'].map(unescapeICalString);
    }

    // TODO: Add recurrence and attendee parsing

    return event;
  } catch {
    // Error is logged but not used
    logger.warn('Error parsing event component');
    return null;
  }
}

/**
 * Custom error class for date parsing issues
 */
export class DateParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DateParsingError';
  }
}

/**
 * Parse a date from iCalendar format (e.g., "20210315" for March 15, 2021)
 * @param dateStr The date string in iCalendar format
 * @returns A Date object
 * @throws DateParsingError if the date string is invalid
 *
 * Performs extensive validation of iCalendar date strings:
 * 1. Format must be exactly YYYYMMDD (8 digits)
 * 2. Year must be between 1900-2100
 * 3. Month must be 01-12
 * 4. Day must be valid for the given month and year (accounting for leap years)
 */
function parseICalDate(dateStr: string): Date {
  // Validate input
  if (!dateStr) {
    logger.warn('parseICalDate: Empty or undefined date string');
    throw new DateParsingError('Date string is required');
  }

  // Clean the string of any whitespace or non-alphanumeric characters
  const cleanStr = dateStr.trim();

  // Check format: exact 8 characters for YYYYMMDD
  if (cleanStr.length !== 8 || !/^\d{8}$/.test(cleanStr)) {
    logger.warn(`parseICalDate: Invalid date format: "${dateStr}"`);
    throw new DateParsingError(`Invalid date format: "${dateStr}". Expected format is YYYYMMDD.`);
  }

  try {
    const year = parseInt(cleanStr.substring(0, 4), 10);
    const month = parseInt(cleanStr.substring(4, 6), 10) - 1; // Months are 0-based in JS
    const day = parseInt(cleanStr.substring(6, 8), 10);

    // Validate date components
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      logger.warn(
        `parseICalDate: Found NaN values in date components: year=${year}, month=${month + 1}, day=${day}`,
      );
      throw new DateParsingError(`Invalid date components in "${dateStr}"`);
    }

    if (year < 1900 || year > 2100) {
      logger.warn(`parseICalDate: Year out of range: ${year}`);
      throw new DateParsingError(`Year out of range: ${year}. Must be between 1900 and 2100.`);
    }

    if (month < 0 || month > 11) {
      logger.warn(`parseICalDate: Month out of range: ${month + 1}`);
      throw new DateParsingError(`Month out of range: ${month + 1}. Must be between 1 and 12.`);
    }

    if (day < 1 || day > 31) {
      logger.warn(`parseICalDate: Day out of range: ${day}`);
      throw new DateParsingError(`Day out of range: ${day}. Must be between 1 and 31.`);
    }

    // Validate days per month (accounting for leap years)
    const maxDaysInMonth = [
      31,
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];
    if (day > maxDaysInMonth[month]) {
      logger.warn(`parseICalDate: Invalid day (${day}) for month ${month + 1} in year ${year}`);
      throw new DateParsingError(`Invalid day (${day}) for month ${month + 1} in year ${year}`);
    }

    // Create date with validated components
    const date = new Date(year, month, day);

    // Verify date construction integrity by checking components match inputs
    // This catches edge cases like DST transitions or other JS Date oddities
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      logger.warn(
        `parseICalDate: Date object construction inconsistency for: ${year}-${month + 1}-${day}, possible invalid date combination`,
      );
      throw new DateParsingError(`Invalid date combination: ${year}-${month + 1}-${day}`);
    }

    return date;
  } catch (error) {
    // Re-throw DateParsingErrors
    if (error instanceof DateParsingError) {
      throw error;
    }

    // Handle any unexpected errors from Date construction
    logger.error(`parseICalDate: Unexpected error parsing date "${dateStr}":`, error);
    throw new DateParsingError(`Failed to parse date "${dateStr}": ${(error as Error).message}`);
  }
}

/**
 * Parse a date and time from iCalendar format (e.g., "20210315T143000Z")
 * @param dateTimeStr The date-time string in iCalendar format
 * @returns A Date object
 * @throws DateParsingError if the datetime string is invalid
 *
 * Supports multiple iCalendar datetime formats:
 * 1. YYYYMMDD - Date only (no time component)
 * 2. YYYYMMDDTHHMMSS - Local date and time
 * 3. YYYYMMDDTHHMMSSZ - UTC date and time
 * 4. Partial time components: HH (hours only) or HHMM (hours and minutes)
 *
 * Performs comprehensive validation:
 * - Format validation (correct characters and structure)
 * - Component range validation (valid year, month, day, hour, minute, second)
 * - Calendar validation (correct days per month, leap year handling)
 * - Timezone handling (UTC vs local time)
 * - Date integrity verification after construction
 */
function parseICalDateTime(dateTimeStr: string): Date {
  // Validate input
  if (!dateTimeStr) {
    logger.warn('parseICalDateTime: Empty or undefined datetime string');
    throw new DateParsingError('Datetime string is required');
  }

  // Trim any whitespace and normalize to uppercase (for Z indicator)
  const inputStr = dateTimeStr.trim().toUpperCase();

  // Basic format check: minimum 8 chars for YYYYMMDD
  if (inputStr.length < 8) {
    logger.warn(
      `parseICalDateTime: String too short (${inputStr.length}), minimum 8 characters required: "${dateTimeStr}"`,
    );
    throw new DateParsingError(
      `Invalid datetime string: "${dateTimeStr}". Too short (minimum 8 characters required).`,
    );
  }

  // Check for valid characters (digits, T separator, Z for UTC)
  const validCharsRegex = /^[\dTZ]+$/;
  if (!validCharsRegex.test(inputStr)) {
    logger.warn(
      `parseICalDateTime: Invalid characters in datetime string, only digits, T, and Z allowed: "${dateTimeStr}"`,
    );
    throw new DateParsingError(
      `Invalid characters in datetime string: "${dateTimeStr}". Only digits, T, and Z are allowed.`,
    );
  }

  // Structure check: If contains T, it must be in position 9 or later (after date part)
  const tIndex = inputStr.indexOf('T');
  if (tIndex > 0 && tIndex < 8) {
    logger.warn(
      `parseICalDateTime: T separator in wrong position (${tIndex}), must be after date part: "${dateTimeStr}"`,
    );
    throw new DateParsingError(
      `Invalid T separator position in "${dateTimeStr}". T must be after date part.`,
    );
  }

  try {
    // CASE 1: Just a date (no time component) - exactly 8 digits
    if (inputStr.length === 8 && /^\d{8}$/.test(inputStr)) {
      logger.debug(`parseICalDateTime: Handling as date-only string (YYYYMMDD): "${inputStr}"`);
      return parseICalDate(inputStr);
    }

    // Handle UTC indicator - 'Z' at the end
    const isUTC = inputStr.endsWith('Z');
    // Remove the 'Z' for further processing
    const cleanStr = isUTC ? inputStr.substring(0, inputStr.length - 1) : inputStr;

    // Find the position of the 'T' separator between date and time
    const tPos = cleanStr.indexOf('T');
    if (tPos <= 0) {
      // No time component separator, so just treat as a date
      return parseICalDate(cleanStr);
    }

    // Split into date and time parts
    const dateStr = cleanStr.substring(0, tPos);
    const timeStr = cleanStr.substring(tPos + 1);

    // Validate date part (should be 8 digits for YYYYMMDD)
    if (dateStr.length !== 8 || !/^\d{8}$/.test(dateStr)) {
      logger.warn(`parseICalDateTime: Invalid date part: "${dateStr}"`);
      throw new DateParsingError(`Invalid date part in datetime string: "${dateStr}"`);
    }

    // Validate time part (should be 2, 4, or 6 digits for HH, HHMM, or HHMMSS)
    if (![2, 4, 6].includes(timeStr.length) || !/^\d+$/.test(timeStr)) {
      logger.warn(`parseICalDateTime: Invalid time part: "${timeStr}"`);
      throw new DateParsingError(
        `Invalid time part in datetime string: "${timeStr}". Should be 2, 4, or 6 digits.`,
      );
    }

    // Parse date components
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Months are 0-based in JS
    const day = parseInt(dateStr.substring(6, 8), 10);

    // Check for NaN in date components
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      logger.warn(
        `parseICalDateTime: Found NaN in date components: year=${year}, month=${month + 1}, day=${day}`,
      );
      throw new DateParsingError(`Invalid date components in "${dateStr}"`);
    }

    // Validate date components
    if (year < 1900 || year > 2100) {
      logger.warn(`parseICalDateTime: Year out of range: ${year}`);
      throw new DateParsingError(`Year out of range: ${year}. Must be between 1900 and 2100.`);
    }

    if (month < 0 || month > 11) {
      logger.warn(`parseICalDateTime: Month out of range: ${month + 1}`);
      throw new DateParsingError(`Month out of range: ${month + 1}. Must be between 1 and 12.`);
    }

    if (day < 1 || day > 31) {
      logger.warn(`parseICalDateTime: Day out of range: ${day}`);
      throw new DateParsingError(`Day out of range: ${day}. Must be between 1 and 31.`);
    }

    // Validate days per month (accounting for leap years)
    const maxDaysInMonth = [
      31,
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];
    if (day > maxDaysInMonth[month]) {
      logger.warn(`parseICalDateTime: Invalid day (${day}) for month ${month + 1} in year ${year}`);
      throw new DateParsingError(`Invalid day (${day}) for month ${month + 1} in year ${year}`);
    }

    // Parse time components with defaults
    let hour = 0,
      minute = 0,
      second = 0;

    if (timeStr.length >= 2) {
      hour = parseInt(timeStr.substring(0, 2), 10);
      if (isNaN(hour) || hour < 0 || hour > 23) {
        logger.warn(`parseICalDateTime: Hour invalid or out of range: ${timeStr.substring(0, 2)}`);
        throw new DateParsingError(
          `Hour invalid or out of range: ${timeStr.substring(0, 2)}. Must be between 0 and 23.`,
        );
      }
    }

    if (timeStr.length >= 4) {
      minute = parseInt(timeStr.substring(2, 4), 10);
      if (isNaN(minute) || minute < 0 || minute > 59) {
        logger.warn(
          `parseICalDateTime: Minute invalid or out of range: ${timeStr.substring(2, 4)}`,
        );
        throw new DateParsingError(
          `Minute invalid or out of range: ${timeStr.substring(2, 4)}. Must be between 0 and 59.`,
        );
      }
    }

    if (timeStr.length >= 6) {
      second = parseInt(timeStr.substring(4, 6), 10);
      if (isNaN(second) || second < 0 || second > 59) {
        logger.warn(
          `parseICalDateTime: Second invalid or out of range: ${timeStr.substring(4, 6)}`,
        );
        throw new DateParsingError(
          `Second invalid or out of range: ${timeStr.substring(4, 6)}. Must be between 0 and 59.`,
        );
      }
    }

    // Create the date object (in UTC or local time as specified)
    let date: Date;
    if (isUTC) {
      date = new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      date = new Date(year, month, day, hour, minute, second);
    }

    // Verify date is valid by checking if the date object's components match our inputs
    if (isUTC) {
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month ||
        date.getUTCDate() !== day ||
        date.getUTCHours() !== hour ||
        date.getUTCMinutes() !== minute ||
        date.getUTCSeconds() !== second
      ) {
        logger.warn(
          `parseICalDateTime: Date object inconsistency for UTC: ${year}-${month + 1}-${day} ${hour}:${minute}:${second}`,
        );
        throw new DateParsingError(
          `Invalid date combination: ${year}-${month + 1}-${day} ${hour}:${minute}:${second}`,
        );
      }
    } else {
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute ||
        date.getSeconds() !== second
      ) {
        logger.warn(
          `parseICalDateTime: Date object inconsistency for local time: ${year}-${month + 1}-${day} ${hour}:${minute}:${second}`,
        );
        throw new DateParsingError(
          `Invalid date combination: ${year}-${month + 1}-${day} ${hour}:${minute}:${second}`,
        );
      }
    }

    return date;
  } catch (error) {
    // Re-throw DateParsingErrors
    if (error instanceof DateParsingError) {
      throw error;
    }

    // Detailed error reporting for more diagnosable issues
    logger.error(
      `parseICalDateTime: Error parsing datetime "${dateTimeStr}": ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
    throw new DateParsingError(
      `Failed to parse datetime "${dateTimeStr}": ${(error as Error).message}`,
    );
  }
}

/**
 * Generate a UID for a new event
 * @returns A unique ID string
 */
function generateUid(): string {
  const timestamp = new Date().getTime();
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}@nextcloud-calendar`;
}

/**
 * Generate an iCalendar RRULE string from a RecurrenceRule object
 * @param rule The RecurrenceRule object
 * @returns An iCalendar RRULE string
 */
function generateRecurrenceRule(rule: RecurrenceRule): string {
  let rrule = 'RRULE:FREQ=' + rule.frequency.toUpperCase();

  if (rule.interval && rule.interval > 0) {
    rrule += `;INTERVAL=${rule.interval}`;
  }

  if (rule.until) {
    // Format the until date in UTC
    const untilStr =
      rule.until
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '')
        .substring(0, 15) + 'Z';
    rrule += `;UNTIL=${untilStr}`;
  }

  if (rule.count && rule.count > 0) {
    rrule += `;COUNT=${rule.count}`;
  }

  if (rule.byDay && rule.byDay.length > 0) {
    rrule += `;BYDAY=${rule.byDay.join(',')}`;
  }

  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    rrule += `;BYMONTHDAY=${rule.byMonthDay.join(',')}`;
  }

  if (rule.byMonth && rule.byMonth.length > 0) {
    rrule += `;BYMONTH=${rule.byMonth.join(',')}`;
  }

  if (rule.bySetPos && rule.bySetPos.length > 0) {
    rrule += `;BYSETPOS=${rule.bySetPos.join(',')}`;
  }

  rrule += '\r\n';

  // Add EXDATE properties for excluded dates
  if (rule.exDates && rule.exDates.length > 0) {
    rule.exDates.forEach((exDate) => {
      const exDateStr =
        exDate
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, '')
          .substring(0, 15) + 'Z';
      rrule += `EXDATE:${exDateStr}\r\n`;
    });
  }

  return rrule;
}

/**
 * Generate an iCalendar VALARM component from an EventReminder object
 * @param reminder The EventReminder object
 * @returns An iCalendar VALARM string
 */
function generateAlarm(reminder: EventReminder): string {
  let alarm = 'BEGIN:VALARM\r\n';

  // The action depends on the reminder type
  if (reminder.type === 'email') {
    alarm += 'ACTION:EMAIL\r\n';
    alarm += 'DESCRIPTION:Reminder\r\n';
  } else {
    alarm += 'ACTION:DISPLAY\r\n';
    alarm += 'DESCRIPTION:Reminder\r\n';
  }

  // Set the trigger (minutes before the event)
  alarm += `TRIGGER:-PT${reminder.minutesBefore}M\r\n`;

  alarm += 'END:VALARM\r\n';
  return alarm;
}

/**
 * Extract an email address from a CAL-ADDRESS value
 * @param calAddress The CAL-ADDRESS value (e.g., "MAILTO:user@example.com")
 * @returns The extracted email address or empty string if invalid
 */
function extractEmailFromCalAddress(calAddress: string): string {
  if (!calAddress) {
    logger.warn('Empty CAL-ADDRESS value provided to extractEmailFromCalAddress');
    return '';
  }

  const mailtoPrefix = 'MAILTO:';
  let email: string;

  if (calAddress.includes(mailtoPrefix)) {
    email = calAddress.substring(calAddress.lastIndexOf(mailtoPrefix) + mailtoPrefix.length);
  } else {
    email = calAddress;
  }

  // Validate the extracted email address
  // Basic validation using a regex pattern for email validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(email)) {
    logger.warn(`Invalid email address format in CAL-ADDRESS: "${email}"`);
    // Return the extracted value anyway but log a warning
    // This ensures backward compatibility with existing data
  }

  // Sanitize the email address by removing potential dangerous characters
  // Allow only alphanumeric characters, @, dots, hyphens, underscores, and plus signs
  const sanitizedEmail = email.replace(/[^\w@.\-+]/g, '');

  if (sanitizedEmail !== email) {
    logger.warn(`Email address sanitized from "${email}" to "${sanitizedEmail}"`);
  }

  return sanitizedEmail;
}

/**
 * Escape special characters in a string for iCalendar format
 * @param input The string to escape
 * @returns The escaped string
 */
function escapeICalString(input: string | null | undefined): string {
  if (input === null || input === undefined) {
    return '';
  }

  return String(input)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Unescape special characters in a string from iCalendar format
 * @param input The string to unescape
 * @returns The unescaped string
 */
function unescapeICalString(input: string): string {
  if (!input) return '';

  return input
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}
