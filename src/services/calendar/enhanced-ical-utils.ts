/**
 * Enhanced iCalendar parsing utilities
 */
import { Event, RecurrenceRule, Participant } from '../../models/index.js';
import { createLogger } from '../logger.js';

const logger = createLogger('EnhancedICalUtils');

/**
 * Enhanced iCalendar parser that handles real Nextcloud iCal data
 */
export class EnhancedICalParser {
  /**
   * Parse iCalendar data into Event objects
   */
  static parseICalEvents(iCalData: string, calendarId: string): Event[] {
    try {
      logger.debug('Parsing iCalendar data with enhanced parser');

      if (!iCalData || typeof iCalData !== 'string') {
        logger.warn('Invalid iCalendar data provided');
        return [];
      }

      const events: Event[] = [];

      // Split into lines and normalize line endings
      const lines = iCalData.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

      // Parse the iCalendar content
      const components = this.extractComponents(lines);

      // Process each VEVENT component
      for (const component of components) {
        if (component.type === 'VEVENT') {
          try {
            const event = this.parseEventComponent(component, calendarId);
            if (event) {
              events.push(event);
            }
          } catch (error) {
            logger.warn('Error parsing event component:', error);
          }
        }
      }

      logger.debug(`Successfully parsed ${events.length} events from iCalendar data`);
      return events;
    } catch (error) {
      logger.error('Error parsing iCalendar data:', error);
      return [];
    }
  }

  /**
   * Extract components from iCal lines
   */
  private static extractComponents(
    lines: string[],
  ): Array<{ type: string; properties: Map<string, unknown> }> {
    const components: Array<{ type: string; properties: Map<string, unknown> }> = [];
    let currentComponent: { type: string; properties: Map<string, unknown> } | null = null;
    let unfoldedLines: string[] = [];

    // First, unfold lines (handle line continuation)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if next line is a continuation (starts with space or tab)
      if (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        let combinedLine = line;
        let j = i + 1;

        while (j < lines.length && (lines[j].startsWith(' ') || lines[j].startsWith('\t'))) {
          combinedLine += lines[j].substring(1); // Remove the leading space/tab
          j++;
        }

        unfoldedLines.push(combinedLine);
        i = j - 1; // Skip the processed continuation lines
      } else {
        unfoldedLines.push(line);
      }
    }

    // Parse unfolded lines
    for (const line of unfoldedLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('BEGIN:')) {
        const componentType = trimmed.substring(6);
        if (componentType === 'VEVENT') {
          currentComponent = {
            type: componentType,
            properties: new Map(),
          };
        }
      } else if (trimmed.startsWith('END:')) {
        const componentType = trimmed.substring(4);
        if (componentType === 'VEVENT' && currentComponent) {
          components.push(currentComponent);
          currentComponent = null;
        }
      } else if (currentComponent) {
        // Parse property line
        const property = this.parsePropertyLine(trimmed);
        if (property) {
          currentComponent.properties.set(property.name, property);
        }
      }
    }

    return components;
  }

  /**
   * Parse a single property line
   */
  private static parsePropertyLine(
    line: string,
  ): { name: string; value: string; params: Map<string, string> } | null {
    try {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) return null;

      const nameAndParams = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);

      // Split name and parameters
      const semicolonIndex = nameAndParams.indexOf(';');
      const name =
        semicolonIndex === -1 ? nameAndParams : nameAndParams.substring(0, semicolonIndex);
      const paramsString = semicolonIndex === -1 ? '' : nameAndParams.substring(semicolonIndex + 1);

      // Parse parameters
      const params = new Map<string, string>();
      if (paramsString) {
        const paramPairs = paramsString.split(';');
        for (const pair of paramPairs) {
          const equalIndex = pair.indexOf('=');
          if (equalIndex !== -1) {
            const paramName = pair.substring(0, equalIndex);
            const paramValue = pair.substring(equalIndex + 1);
            params.set(paramName, paramValue);
          }
        }
      }

      return { name, value, params };
    } catch (error) {
      logger.warn('Error parsing property line:', line, error);
      return null;
    }
  }

  /**
   * Parse a VEVENT component into an Event object
   */
  private static parseEventComponent(
    component: { type: string; properties: Map<string, unknown> },
    calendarId: string,
  ): Event | null {
    try {
      const props = component.properties;

      // Required fields
      const uid = props.get('UID')?.value;
      const summary = props.get('SUMMARY')?.value;
      const dtstart = props.get('DTSTART');
      const dtend = props.get('DTEND');

      if (!uid || !dtstart) {
        logger.warn('Event missing required fields (UID or DTSTART)');
        return null;
      }

      // Parse dates
      const startDate = this.parseICalDate(dtstart);
      let endDate = dtend ? this.parseICalDate(dtend) : null;

      if (!startDate) {
        logger.warn('Could not parse start date');
        return null;
      }

      // If no end date, make it same as start date
      if (!endDate) {
        endDate = new Date(startDate);
      }

      // Determine if all-day event
      const isAllDay = dtstart.params?.get('VALUE') === 'DATE';

      // Create event object
      const event: Event = {
        id: uid,
        calendarId,
        title: summary || 'Untitled Event',
        description: props.get('DESCRIPTION')?.value || '',
        start: startDate,
        end: endDate,
        isAllDay,
        location: props.get('LOCATION')?.value || '',
        status: this.parseEventStatus(props.get('STATUS')?.value),
        visibility: this.parseEventVisibility(props.get('CLASS')?.value),
        availability: this.parseEventAvailability(props.get('TRANSP')?.value),
        categories: this.parseCategories(props.get('CATEGORIES')?.value),
        reminders: [],
        participants: [],
        created: this.parseICalDate(props.get('CREATED')) || new Date(),
        lastModified: this.parseICalDate(props.get('LAST-MODIFIED')) || new Date(),
      };

      // Parse recurrence rule if present
      const rrule = props.get('RRULE')?.value;
      if (rrule) {
        event.recurrenceRule = this.parseRecurrenceRule(rrule);
      }

      // Parse organizer
      const organizer = props.get('ORGANIZER');
      if (organizer) {
        event.organizer = this.parseOrganizer(organizer);
      }

      // Parse attendees
      const attendees: Participant[] = [];
      for (const [key, prop] of props) {
        if (key === 'ATTENDEE') {
          const attendee = this.parseAttendee(prop);
          if (attendee) {
            attendees.push(attendee);
          }
        }
      }
      event.participants = attendees;

      return event;
    } catch (error) {
      logger.error('Error parsing event component:', error);
      return null;
    }
  }

  /**
   * Parse iCalendar date string
   */
  private static parseICalDate(
    dateProperty: { value: string; params?: Map<string, string> } | null,
  ): Date | null {
    if (!dateProperty || !dateProperty.value) return null;

    try {
      const dateStr = dateProperty.value;

      // Handle different date formats
      if (dateProperty.params?.get('VALUE') === 'DATE') {
        // Date only (YYYYMMDD)
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-based
        const day = parseInt(dateStr.substring(6, 8));
        return new Date(year, month, day);
      } else {
        // DateTime format (YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS)
        let isoString = dateStr;

        // Convert iCal format to ISO format
        if (isoString.length === 15 && isoString.endsWith('Z')) {
          // YYYYMMDDTHHMMSSZ -> YYYY-MM-DDTHH:MM:SSZ
          isoString = `${isoString.substring(0, 4)}-${isoString.substring(4, 6)}-${isoString.substring(6, 8)}T${isoString.substring(9, 11)}:${isoString.substring(11, 13)}:${isoString.substring(13, 15)}Z`;
        } else if (isoString.length === 15) {
          // YYYYMMDDTHHMMSS -> YYYY-MM-DDTHH:MM:SS
          isoString = `${isoString.substring(0, 4)}-${isoString.substring(4, 6)}-${isoString.substring(6, 8)}T${isoString.substring(9, 11)}:${isoString.substring(11, 13)}:${isoString.substring(13, 15)}`;
        } else if (isoString.length === 8) {
          // YYYYMMDD -> YYYY-MM-DD
          isoString = `${isoString.substring(0, 4)}-${isoString.substring(4, 6)}-${isoString.substring(6, 8)}`;
        } else if (isoString.includes('T')) {
          // Handle other formats with T separator
          const tIndex = isoString.indexOf('T');
          if (tIndex === 8) {
            // YYYYMMDDTHHMMSS -> YYYY-MM-DDTHH:MM:SS
            isoString = `${isoString.substring(0, 4)}-${isoString.substring(4, 6)}-${isoString.substring(6, 8)}T${isoString.substring(9, 11)}:${isoString.substring(11, 13)}:${isoString.substring(13)}`;
          }
        }

        return new Date(isoString);
      }
    } catch (error) {
      logger.warn('Error parsing iCal date:', dateProperty.value, error);
      return null;
    }
  }

  /**
   * Parse event status
   */
  private static parseEventStatus(status: string): 'confirmed' | 'tentative' | 'cancelled' {
    if (!status) return 'confirmed';

    switch (status.toUpperCase()) {
      case 'TENTATIVE':
        return 'tentative';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'confirmed';
    }
  }

  /**
   * Parse event visibility
   */
  private static parseEventVisibility(classValue: string): 'public' | 'private' | 'confidential' {
    if (!classValue) return 'public';

    switch (classValue.toUpperCase()) {
      case 'PRIVATE':
        return 'private';
      case 'CONFIDENTIAL':
        return 'confidential';
      default:
        return 'public';
    }
  }

  /**
   * Parse event availability
   */
  private static parseEventAvailability(transp: string): 'free' | 'busy' {
    if (!transp) return 'busy';

    switch (transp.toUpperCase()) {
      case 'TRANSPARENT':
        return 'free';
      default:
        return 'busy';
    }
  }

  /**
   * Parse categories
   */
  private static parseCategories(categories: string): string[] {
    if (!categories) return [];

    return categories
      .split(',')
      .map((cat) => cat.trim())
      .filter((cat) => cat);
  }

  /**
   * Parse recurrence rule
   */
  private static parseRecurrenceRule(rrule: string): RecurrenceRule | undefined {
    try {
      // Basic RRULE parsing - implement as needed
      const rule: Partial<RecurrenceRule> = {};

      const parts = rrule.split(';');
      for (const part of parts) {
        const [key, value] = part.split('=');

        switch (key) {
          case 'FREQ':
            if (value === 'DAILY') rule.frequency = 'daily';
            else if (value === 'WEEKLY') rule.frequency = 'weekly';
            else if (value === 'MONTHLY') rule.frequency = 'monthly';
            else if (value === 'YEARLY') rule.frequency = 'yearly';
            break;
          case 'INTERVAL':
            rule.interval = parseInt(value);
            break;
          case 'COUNT':
            rule.count = parseInt(value);
            break;
          case 'UNTIL': {
            // Parse the UNTIL date string into a Date object
            const untilDate = this.parseICalDate({ value, params: new Map() });
            if (untilDate) {
              rule.until = untilDate;
            }
            break;
          }
        }
      }

      return rule.frequency ? (rule as RecurrenceRule) : undefined;
    } catch (error) {
      logger.warn('Error parsing recurrence rule:', rrule, error);
      return undefined;
    }
  }

  /**
   * Parse organizer
   */
  private static parseOrganizer(organizer: {
    value: string;
    params?: Map<string, string>;
  }): string | undefined {
    if (!organizer || !organizer.value) return undefined;

    // Extract email from mailto: URL
    const email = organizer.value.replace(/^mailto:/, '');
    return email;
  }

  /**
   * Parse attendee
   */
  private static parseAttendee(attendee: {
    value: string;
    params?: Map<string, string>;
  }): Participant | undefined {
    if (!attendee || !attendee.value) return undefined;

    try {
      const email = attendee.value.replace(/^mailto:/, '');
      const name = attendee.params?.get('CN') || email;
      const role = attendee.params?.get('ROLE') === 'OPT-PARTICIPANT' ? 'optional' : 'required';

      let status: 'accepted' | 'declined' | 'tentative' | 'needs-action' = 'needs-action';
      const partstat = attendee.params?.get('PARTSTAT');
      if (partstat) {
        switch (partstat.toUpperCase()) {
          case 'ACCEPTED':
            status = 'accepted';
            break;
          case 'DECLINED':
            status = 'declined';
            break;
          case 'TENTATIVE':
            status = 'tentative';
            break;
        }
      }

      return {
        email,
        name,
        role,
        status,
        type: 'individual',
      };
    } catch (error) {
      logger.warn('Error parsing attendee:', attendee, error);
      return undefined;
    }
  }

  /**
   * Generate iCalendar data from Event object (improved version)
   */
  static generateICalEvent(event: Event): string {
    try {
      logger.debug(`Generating iCalendar data for event ${event.id}`);

      const lines: string[] = [];

      // Calendar header
      lines.push('BEGIN:VCALENDAR');
      lines.push('VERSION:2.0');
      lines.push('PRODID:-//Nextcloud Calendar MCP//EN');
      lines.push('CALSCALE:GREGORIAN');

      // Event
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${event.id}`);
      lines.push(`DTSTAMP:${this.formatICalDate(new Date())}`);

      if (event.created) {
        lines.push(`CREATED:${this.formatICalDate(event.created)}`);
      }

      if (event.lastModified) {
        lines.push(`LAST-MODIFIED:${this.formatICalDate(event.lastModified)}`);
      }

      // Dates
      if (event.isAllDay) {
        lines.push(`DTSTART;VALUE=DATE:${this.formatICalDate(event.start, true)}`);
        lines.push(`DTEND;VALUE=DATE:${this.formatICalDate(event.end, true)}`);
      } else {
        lines.push(`DTSTART:${this.formatICalDate(event.start)}`);
        lines.push(`DTEND:${this.formatICalDate(event.end)}`);
      }

      // Basic properties
      lines.push(`SUMMARY:${this.escapeICalText(event.title)}`);

      if (event.description) {
        lines.push(`DESCRIPTION:${this.escapeICalText(event.description)}`);
      }

      if (event.location) {
        lines.push(`LOCATION:${this.escapeICalText(event.location)}`);
      }

      // Status
      if (event.status) {
        lines.push(`STATUS:${event.status.toUpperCase()}`);
      }

      // Availability
      if (event.availability) {
        lines.push(`TRANSP:${event.availability === 'free' ? 'TRANSPARENT' : 'OPAQUE'}`);
      }

      // Categories
      if (event.categories && event.categories.length > 0) {
        lines.push(`CATEGORIES:${event.categories.join(',')}`);
      }

      lines.push('END:VEVENT');
      lines.push('END:VCALENDAR');

      return lines.join('\r\n');
    } catch (error) {
      logger.error('Error generating iCalendar data:', error);
      throw new Error(`Failed to generate iCalendar data: ${error}`);
    }
  }

  /**
   * Format date for iCalendar
   */
  private static formatICalDate(date: Date, dateOnly = false): string {
    if (dateOnly) {
      return date.toISOString().substring(0, 10).replace(/-/g, '');
    } else {
      return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    }
  }

  /**
   * Escape text for iCalendar
   */
  private static escapeICalText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }
}
