/**
 * Timezone utility service for handling date/time conversions
 */

export class TimezoneService {
  private defaultTimezone: string;
  private useLocalTimezone: boolean;

  constructor(defaultTimezone: string = 'Europe/Paris', useLocalTimezone: boolean = true) {
    this.defaultTimezone = defaultTimezone;
    this.useLocalTimezone = useLocalTimezone;
  }

  /**
   * Convert a UTC date to the user's local timezone
   */
  toLocal(utcDate: Date): Date {
    if (!this.useLocalTimezone) {
      return utcDate;
    }

    // Create a new date in the user's timezone
    const localDate = new Date(utcDate.toLocaleString('en-US', { timeZone: this.defaultTimezone }));
    return localDate;
  }

  /**
   * Convert a local date to UTC
   */
  toUTC(localDate: Date): Date {
    if (!this.useLocalTimezone) {
      return localDate;
    }

    // Convert local date to UTC
    const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
    return utcDate;
  }

  /**
   * Format a date in the user's timezone
   */
  formatInTimezone(date: Date, options?: Intl.DateTimeFormatOptions): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: this.defaultTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    };

    return date.toLocaleString('en-US', defaultOptions);
  }

  /**
   * Format a date as a readable string in the user's timezone
   */
  formatAsReadable(date: Date): string {
    return this.formatInTimezone(date, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Format a date for all-day events
   */
  formatAllDay(date: Date): string {
    return this.formatInTimezone(date, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Get the current date/time in the user's timezone
   */
  now(): Date {
    const utcNow = new Date();
    return this.toLocal(utcNow);
  }

  /**
   * Get timezone information
   */
  getTimezoneInfo(): { timezone: string; offset: string; name: string } {
    const now = new Date();
    const offset = now.toLocaleString('en-US', {
      timeZone: this.defaultTimezone,
      timeZoneName: 'longOffset',
    });

    const name = now.toLocaleString('en-US', {
      timeZone: this.defaultTimezone,
      timeZoneName: 'long',
    });

    return {
      timezone: this.defaultTimezone,
      offset: offset.split(' ').pop() || '',
      name: name.split(' ').slice(-2).join(' ') || this.defaultTimezone,
    };
  }

  /**
   * Check if a date is in daylight saving time
   */
  isDST(date: Date): boolean {
    const january = new Date(date.getFullYear(), 0, 1);
    const july = new Date(date.getFullYear(), 6, 1);

    const janOffset = january.getTimezoneOffset();
    const julOffset = july.getTimezoneOffset();

    return Math.max(janOffset, julOffset) !== date.getTimezoneOffset();
  }

  /**
   * Create a date range string for display
   */
  formatDateRange(start: Date, end: Date, isAllDay: boolean = false): string {
    if (isAllDay) {
      const startStr = this.formatAllDay(start);
      const endStr = this.formatAllDay(end);

      // Check if it's the same day
      if (start.toDateString() === end.toDateString()) {
        return startStr;
      }

      return `${startStr} - ${endStr}`;
    }

    const startStr = this.formatAsReadable(start);
    const endStr = this.formatInTimezone(end, {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Check if it's the same day
    if (start.toDateString() === end.toDateString()) {
      return `${startStr} - ${endStr}`;
    }

    const endFullStr = this.formatAsReadable(end);
    return `${startStr} - ${endFullStr}`;
  }
}

/**
 * Default timezone service instance
 */
export const defaultTimezoneService = new TimezoneService();
