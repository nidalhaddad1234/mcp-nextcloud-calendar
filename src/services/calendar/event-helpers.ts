/**
 * Helper functions for validating and processing event data
 */
import type { Participant, RecurrenceRule } from '../../models/calendar.js';

/**
 * Helper functions for validating and processing event data
 */
export const EventHelpers = {
  /**
   * Validates a date string and returns a Date object
   * @param dateString Date string to validate
   * @param fieldName Name of the field for error message
   * @returns Valid Date object
   * @throws Error if date is invalid
   */
  validateDate(dateString: string, fieldName: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid ${fieldName} date format`);
    }
    return date;
  },

  /**
   * Validates that startDate is before endDate
   * @param startDate Start date to validate
   * @param endDate End date to validate
   * @throws Error if start date is not before end date
   */
  validateDateRange(startDate: Date, endDate: Date): void {
    if (startDate >= endDate) {
      throw new Error('Start date must be before end date');
    }
  },

  /**
   * Validates an email address format
   * @param email Email address to validate
   * @returns True if email is valid, false otherwise
   */
  isValidEmail(email: string): boolean {
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validates a number is within specified range
   * @param value Number to validate
   * @param min Minimum value (inclusive)
   * @param max Maximum value (inclusive)
   * @param fieldName Name of the field for error message
   * @returns The validated number
   * @throws Error if number is invalid or outside range
   */
  validateNumberInRange(value: unknown, min: number, max: number, fieldName: string): number {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Invalid ${fieldName} value: must be a number`);
    }
    return Math.min(Math.max(min, Math.round(num)), max);
  },

  /**
   * Processes recurrence rule and validates all fields
   * @param recurrenceRule Recurrence rule object from request
   * @returns Processed recurrence rule with validated fields
   * @throws Error if required fields are missing or invalid
   */
  processRecurrenceRule(recurrenceRule: Record<string, unknown>): RecurrenceRule {
    // Validate required frequency field
    if (!recurrenceRule.frequency) {
      throw new Error('Recurrence rule must include a frequency');
    }

    const frequency = recurrenceRule.frequency as string;
    const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validFrequencies.includes(frequency)) {
      throw new Error(
        `Invalid frequency: ${frequency}. Must be one of: ${validFrequencies.join(', ')}`,
      );
    }

    // Validate numeric fields
    let interval: number | undefined = undefined;
    if (recurrenceRule.interval !== undefined) {
      const num = Number(recurrenceRule.interval);
      if (isNaN(num) || num <= 0) {
        throw new Error('Interval must be a positive number');
      }
      interval = num;
    }

    let count: number | undefined = undefined;
    if (recurrenceRule.count !== undefined) {
      const num = Number(recurrenceRule.count);
      if (isNaN(num) || num <= 0) {
        throw new Error('Count must be a positive number');
      }
      count = num;
    }

    // Validate until date if provided
    let untilDate = undefined;
    if (recurrenceRule.until) {
      untilDate = this.validateDate(recurrenceRule.until as string, 'recurrence rule until');
    }

    // Validate array fields
    const validateDayArray = (
      days: unknown,
    ): ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[] | undefined => {
      if (!days) return undefined;
      if (!Array.isArray(days)) throw new Error('byDay must be an array');

      const validDays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
      for (const day of days) {
        if (!validDays.includes(day as string)) {
          throw new Error(`Invalid day: ${day}. Must be one of: ${validDays.join(', ')}`);
        }
      }
      return days as ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[];
    };

    const validateNumberArray = (numbers: unknown, fieldName: string): number[] | undefined => {
      if (!numbers) return undefined;
      if (!Array.isArray(numbers)) throw new Error(`${fieldName} must be an array`);

      for (const num of numbers) {
        if (isNaN(Number(num))) {
          throw new Error(`Invalid ${fieldName} value: ${num}. Must be a number.`);
        }
      }
      return numbers.map((n) => Number(n));
    };

    // Return properly typed RecurrenceRule object
    return {
      frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
      interval,
      until: untilDate,
      count,
      byDay: validateDayArray(recurrenceRule.byDay),
      byMonthDay: validateNumberArray(recurrenceRule.byMonthDay, 'byMonthDay'),
      byMonth: validateNumberArray(recurrenceRule.byMonth, 'byMonth'),
      bySetPos: validateNumberArray(recurrenceRule.bySetPos, 'bySetPos'),
      exDates: undefined, // This field isn't in the input
    };
  },

  /**
   * Validates and normalizes focusPriority within range 1-10
   * @param value Input value
   * @returns Normalized value or undefined if input is undefined
   * @throws Error if value is not a valid number
   */
  validateFocusPriority(value: number | undefined): number | undefined {
    if (value === undefined) return undefined;
    return this.validateNumberInRange(value, 1, 10, 'focusPriority');
  },

  /**
   * Validates and normalizes energyLevel within range 1-5
   * @param value Input value
   * @returns Normalized value or undefined if input is undefined
   * @throws Error if value is not a valid number
   */
  validateEnergyLevel(value: number | undefined): number | undefined {
    if (value === undefined) return undefined;
    return this.validateNumberInRange(value, 1, 5, 'energyLevel');
  },

  /**
   * Validates and sanitizes the adhdCategory field
   * @param category The category value to validate
   * @returns The sanitized category value
   * @throws Error if category is invalid
   */
  validateAdhdCategory(category: string | undefined): string | undefined {
    if (category === undefined) return undefined;

    // Trim and convert to lowercase for validation
    const trimmedCategory = String(category).trim();

    // List of allowed categories (can be expanded as needed)
    const allowedCategories = [
      'focus',
      'routine',
      'important',
      'urgent',
      'long-term',
      'quick-task',
      'high-energy',
      'low-energy',
      'personal',
      'work',
    ];

    // For custom categories, enforce some basic rules
    if (!allowedCategories.includes(trimmedCategory.toLowerCase())) {
      // Prevent very long categories
      if (trimmedCategory.length > 30) {
        throw new Error('ADHD category name is too long (max 30 characters)');
      }

      // Prevent potentially unsafe characters
      const safePattern = /^[a-zA-Z0-9\s\-_]+$/;
      if (!safePattern.test(trimmedCategory)) {
        throw new Error('ADHD category contains invalid characters');
      }
    }

    return trimmedCategory;
  },

  /**
   * Ensures participants have valid data and required fields
   * @param participants Array of participants
   * @returns Array of validated participants
   * @throws Error if participant data is invalid
   */
  validateParticipants(
    participants: Record<string, unknown>[] | undefined,
  ): Participant[] | undefined {
    if (!participants) return undefined;

    return participants.map((p) => {
      // Validate required email field
      const email = p.email as string;
      if (!email) {
        throw new Error('Participant email is required');
      }

      if (!this.isValidEmail(email)) {
        throw new Error(`Invalid email format: ${email}`);
      }

      return {
        email,
        name: p.name as string | null | undefined,
        status: (p.status as Participant['status'] | undefined) || 'needs-action',
        role: p.role as 'required' | 'optional' | undefined,
        type: p.type as 'individual' | 'group' | 'resource' | 'room' | undefined,
        comment: p.comment as string | null | undefined,
      };
    });
  },
};
