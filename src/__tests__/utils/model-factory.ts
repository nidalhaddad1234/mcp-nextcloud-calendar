/**
 * Test factory for creating model instances
 */
import {
  Calendar,
  CalendarPermissions,
  Event,
  Participant,
  RecurrenceRule,
  EventReminder,
} from '../../models/calendar.js';

/**
 * Factory for creating test model instances
 */
export class ModelFactory {
  /**
   * Create a Calendar instance with default values
   * @param overrides Properties to override defaults
   * @returns A Calendar instance
   */
  static createCalendar(overrides: Partial<Calendar> = {}): Calendar {
    const defaults: Calendar = {
      id: 'test-calendar',
      displayName: 'Test Calendar',
      color: '#0082c9',
      owner: 'testuser',
      isDefault: false,
      isShared: false,
      isReadOnly: false,
      permissions: this.createCalendarPermissions(),
      url: 'https://nextcloud.example.com/remote.php/dav/calendars/testuser/test-calendar/',
      category: null,
      focusPriority: null,
      metadata: null,
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create calendar permissions with default values
   * @param overrides Properties to override defaults
   * @returns A CalendarPermissions instance
   */
  static createCalendarPermissions(
    overrides: Partial<CalendarPermissions> = {},
  ): CalendarPermissions {
    const defaults: CalendarPermissions = {
      canRead: true,
      canWrite: true,
      canShare: true,
      canDelete: true,
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create an Event instance with default values
   * @param overrides Properties to override defaults
   * @returns An Event instance
   */
  static createEvent(overrides: Partial<Event> = {}): Event {
    const now = new Date();
    const hourLater = new Date(now.getTime() + 60 * 60 * 1000);

    const defaults: Event = {
      id: 'test-event',
      calendarId: 'test-calendar',
      title: 'Test Event',
      description: 'This is a test event',
      start: now,
      end: hourLater,
      isAllDay: false,
      location: 'Test Location',
      organizer: 'testuser@example.com',
      participants: [],
      status: 'confirmed',
      visibility: 'public',
      availability: 'busy',
      reminders: [],
      color: null,
      categories: ['test', 'sample'],
      created: new Date(now.getTime() - 60 * 60 * 1000),
      lastModified: now,
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create a Participant instance with default values
   * @param overrides Properties to override defaults
   * @returns A Participant instance
   */
  static createParticipant(overrides: Partial<Participant> = {}): Participant {
    const defaults: Participant = {
      email: 'participant@example.com',
      name: 'Test Participant',
      status: 'needs-action',
      role: 'required',
      type: 'individual',
      comment: null,
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create a RecurrenceRule instance with default values
   * @param overrides Properties to override defaults
   * @returns A RecurrenceRule instance
   */
  static createRecurrenceRule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
    const defaults: RecurrenceRule = {
      frequency: 'daily',
      interval: 1,
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create an EventReminder instance with default values
   * @param overrides Properties to override defaults
   * @returns An EventReminder instance
   */
  static createReminder(overrides: Partial<EventReminder> = {}): EventReminder {
    const defaults: EventReminder = {
      type: 'notification',
      minutesBefore: 15,
      isSent: false,
    };

    return { ...defaults, ...overrides };
  }

  /**
   * Create multiple Calendar instances
   * @param count Number of calendars to create
   * @param overridesFn Function to generate overrides for each calendar
   * @returns Array of Calendar instances
   */
  static createCalendars(
    count: number,
    overridesFn?: (index: number) => Partial<Calendar>,
  ): Calendar[] {
    return Array.from({ length: count }, (_, i) => {
      const overrides = overridesFn ? overridesFn(i) : {};
      return this.createCalendar({
        id: `test-calendar-${i}`,
        displayName: `Test Calendar ${i}`,
        ...overrides,
      });
    });
  }

  /**
   * Create multiple Event instances
   * @param count Number of events to create
   * @param overridesFn Function to generate overrides for each event
   * @returns Array of Event instances
   */
  static createEvents(count: number, overridesFn?: (index: number) => Partial<Event>): Event[] {
    const now = new Date();

    return Array.from({ length: count }, (_, i) => {
      const overrides = overridesFn ? overridesFn(i) : {};
      return this.createEvent({
        id: `test-event-${i}`,
        title: `Test Event ${i}`,
        start: new Date(now.getTime() + i * 24 * 60 * 60 * 1000),
        end: new Date(now.getTime() + i * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
        ...overrides,
      });
    });
  }
}
