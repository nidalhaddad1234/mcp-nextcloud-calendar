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
    let start: Date | null = null;
    let end: Date | null = null;
    let isAllDay = false;

    // Handle all-day events
    if (lines.some((line) => line.startsWith('DTSTART;VALUE=DATE:'))) {
      isAllDay = true;
      const startDate = lines.find((line) => line.startsWith('DTSTART'))?.split(':')[1];
      const endDate = lines.find((line) => line.startsWith('DTEND'))?.split(':')[1];

      if (startDate) {
        start = parseICalDate(startDate);
      }

      if (endDate) {
        // For all-day events, the end date is exclusive
        end = parseICalDate(endDate);
        if (end) {
          end.setDate(end.getDate() - 1);
        }
      }
    } else {
      // Regular events with time
      const startTime = props['DTSTART'];
      const endTime = props['DTEND'];

      if (startTime) {
        start = parseICalDateTime(startTime);
      }

      if (endTime) {
        end = parseICalDateTime(endTime);
      }
    }

    // If we couldn't parse the dates, can't create a valid event
    if (!start || !end) return null;

    // Parse creation/modification dates
    const created = props['CREATED']
      ? parseICalDateTime(props['CREATED']) || new Date()
      : new Date();
    const lastModified = props['LAST-MODIFIED']
      ? parseICalDateTime(props['LAST-MODIFIED']) || new Date()
      : new Date();

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
 * Parse a date from iCalendar format (e.g., "20210315" for March 15, 2021)
 * @param dateStr The date string in iCalendar format
 * @returns A Date object or null if invalid
 */
function parseICalDate(dateStr: string): Date | null {
  // Validate input
  if (!dateStr) {
    logger.warn('parseICalDate: Empty or undefined date string');
    return null;
  }

  // Check format: exact 8 characters for YYYYMMDD
  if (dateStr.length !== 8 || !/^\d{8}$/.test(dateStr)) {
    logger.warn(`parseICalDate: Invalid date format: "${dateStr}"`);
    return null;
  }

  try {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Months are 0-based in JS
    const day = parseInt(dateStr.substring(6, 8), 10);

    // Validate date components
    if (year < 1900 || year > 2100) {
      logger.warn(`parseICalDate: Year out of range: ${year}`);
      return null;
    }

    if (month < 0 || month > 11) {
      logger.warn(`parseICalDate: Month out of range: ${month + 1}`);
      return null;
    }

    if (day < 1 || day > 31) {
      logger.warn(`parseICalDate: Day out of range: ${day}`);
      return null;
    }

    // Create date and validate (this will handle invalid dates like Feb 30)
    const date = new Date(year, month, day);

    // Check if the date is valid by seeing if the components match what we provided
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      logger.warn(`parseICalDate: Invalid date: ${year}-${month + 1}-${day}`);
      return null;
    }

    return date;
  } catch (error) {
    logger.warn(`parseICalDate: Error parsing date "${dateStr}":`, error);
    return null;
  }
}

/**
 * Parse a date and time from iCalendar format (e.g., "20210315T143000Z")
 * @param dateTimeStr The date-time string in iCalendar format
 * @returns A Date object or null if invalid
 */
function parseICalDateTime(dateTimeStr: string): Date | null {
  // Validate input
  if (!dateTimeStr) {
    logger.warn('parseICalDateTime: Empty or undefined datetime string');
    return null;
  }

  // Basic format check: minimum 8 chars, only contains allowed characters
  if (dateTimeStr.length < 8 || !/^[\dTZ]+$/.test(dateTimeStr)) {
    logger.warn(`parseICalDateTime: Invalid datetime format: "${dateTimeStr}"`);
    return null;
  }

  try {
    // Check if it's just a date (no time component)
    if (dateTimeStr.length === 8 && /^\d{8}$/.test(dateTimeStr)) {
      return parseICalDate(dateTimeStr);
    }

    // Remove the 'Z' at the end if present
    const isUTC = dateTimeStr.endsWith('Z');
    const cleanStr = isUTC ? dateTimeStr.substring(0, dateTimeStr.length - 1) : dateTimeStr;

    // Check for the 'T' separator
    const tPos = cleanStr.indexOf('T');
    if (tPos <= 0) {
      // No time component, just a date
      return parseICalDate(cleanStr);
    }

    // Split into date and time parts
    const dateStr = cleanStr.substring(0, tPos);
    const timeStr = cleanStr.substring(tPos + 1);

    // Validate date part (should be 8 digits)
    if (dateStr.length !== 8 || !/^\d{8}$/.test(dateStr)) {
      logger.warn(`parseICalDateTime: Invalid date part: "${dateStr}"`);
      return null;
    }

    // Validate time part (should be 2, 4, or 6 digits)
    if (![2, 4, 6].includes(timeStr.length) || !/^\d+$/.test(timeStr)) {
      logger.warn(`parseICalDateTime: Invalid time part: "${timeStr}"`);
      return null;
    }

    // Parse date
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1; // Months are 0-based in JS
    const day = parseInt(dateStr.substring(6, 8), 10);

    // Validate date components
    if (year < 1900 || year > 2100) {
      logger.warn(`parseICalDateTime: Year out of range: ${year}`);
      return null;
    }

    if (month < 0 || month > 11) {
      logger.warn(`parseICalDateTime: Month out of range: ${month + 1}`);
      return null;
    }

    if (day < 1 || day > 31) {
      logger.warn(`parseICalDateTime: Day out of range: ${day}`);
      return null;
    }

    // Parse time
    let hour = 0,
      minute = 0,
      second = 0;

    if (timeStr.length >= 2) {
      hour = parseInt(timeStr.substring(0, 2), 10);
      if (hour < 0 || hour > 23) {
        logger.warn(`parseICalDateTime: Hour out of range: ${hour}`);
        return null;
      }
    }

    if (timeStr.length >= 4) {
      minute = parseInt(timeStr.substring(2, 4), 10);
      if (minute < 0 || minute > 59) {
        logger.warn(`parseICalDateTime: Minute out of range: ${minute}`);
        return null;
      }
    }

    if (timeStr.length >= 6) {
      second = parseInt(timeStr.substring(4, 6), 10);
      if (second < 0 || second > 59) {
        logger.warn(`parseICalDateTime: Second out of range: ${second}`);
        return null;
      }
    }

    // Create the date object
    let date: Date;
    if (isUTC) {
      date = new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      date = new Date(year, month, day, hour, minute, second);
    }

    // Validate the date by checking if components match
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
          `parseICalDateTime: Invalid UTC datetime: ${year}-${month + 1}-${day} ${hour}:${minute}:${second}`,
        );
        return null;
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
          `parseICalDateTime: Invalid datetime: ${year}-${month + 1}-${day} ${hour}:${minute}:${second}`,
        );
        return null;
      }
    }

    return date;
  } catch (error) {
    logger.warn(`parseICalDateTime: Error parsing datetime "${dateTimeStr}":`, error);
    return null;
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
 * @returns The extracted email address
 */
function extractEmailFromCalAddress(calAddress: string): string {
  const mailtoPrefix = 'MAILTO:';

  if (calAddress.includes(mailtoPrefix)) {
    return calAddress.substring(calAddress.lastIndexOf(mailtoPrefix) + mailtoPrefix.length);
  }

  return calAddress;
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
