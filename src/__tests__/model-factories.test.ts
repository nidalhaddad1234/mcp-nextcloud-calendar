/**
 * Tests for the model factories and fixtures
 */
import { ModelFactory, Fixtures, ConfigFactory } from './utils/index.js';

describe('ModelFactory', () => {
  describe('createCalendar', () => {
    it('should create a calendar with default values', () => {
      const calendar = ModelFactory.createCalendar();

      expect(calendar).toBeDefined();
      expect(calendar.id).toBe('test-calendar');
      expect(calendar.displayName).toBe('Test Calendar');
      expect(calendar.color).toBe('#0082c9');
      expect(calendar.owner).toBe('testuser');
      expect(calendar.isDefault).toBe(false);
      expect(calendar.permissions.canRead).toBe(true);
      expect(calendar.permissions.canWrite).toBe(true);
    });

    it('should override default values with provided ones', () => {
      const calendar = ModelFactory.createCalendar({
        id: 'custom-id',
        displayName: 'Custom Calendar',
        isDefault: true,
      });

      expect(calendar.id).toBe('custom-id');
      expect(calendar.displayName).toBe('Custom Calendar');
      expect(calendar.isDefault).toBe(true);
      // Non-overridden values should keep defaults
      expect(calendar.color).toBe('#0082c9');
    });

    it('should create multiple calendars', () => {
      const calendars = ModelFactory.createCalendars(3);

      expect(calendars).toHaveLength(3);
      expect(calendars[0].id).toBe('test-calendar-0');
      expect(calendars[1].id).toBe('test-calendar-1');
      expect(calendars[2].id).toBe('test-calendar-2');
    });

    it('should apply overrides to multiple calendars', () => {
      const calendars = ModelFactory.createCalendars(2, (index) => ({
        color: `#${index}00000`,
        isDefault: index === 0,
      }));

      expect(calendars[0].color).toBe('#000000');
      expect(calendars[0].isDefault).toBe(true);
      expect(calendars[1].color).toBe('#100000');
      expect(calendars[1].isDefault).toBe(false);
    });
  });

  describe('createEvent', () => {
    it('should create an event with default values', () => {
      const event = ModelFactory.createEvent();

      expect(event).toBeDefined();
      expect(event.id).toBe('test-event');
      expect(event.title).toBe('Test Event');
      expect(event.calendarId).toBe('test-calendar');
      expect(event.isAllDay).toBe(false);
      expect(event.start).toBeInstanceOf(Date);
      expect(event.end).toBeInstanceOf(Date);
    });

    it('should override default values with provided ones', () => {
      const start = new Date('2025-01-01T10:00:00Z');
      const end = new Date('2025-01-01T11:00:00Z');

      const event = ModelFactory.createEvent({
        id: 'custom-event',
        title: 'Custom Event',
        start,
        end,
        isAllDay: true,
      });

      expect(event.id).toBe('custom-event');
      expect(event.title).toBe('Custom Event');
      expect(event.start).toBe(start);
      expect(event.end).toBe(end);
      expect(event.isAllDay).toBe(true);
    });

    it('should create multiple events', () => {
      const events = ModelFactory.createEvents(3);

      expect(events).toHaveLength(3);
      expect(events[0].id).toBe('test-event-0');
      expect(events[1].id).toBe('test-event-1');
      expect(events[2].id).toBe('test-event-2');
    });
  });

  describe('createParticipant', () => {
    it('should create a participant with default values', () => {
      const participant = ModelFactory.createParticipant();

      expect(participant).toBeDefined();
      expect(participant.email).toBe('participant@example.com');
      expect(participant.name).toBe('Test Participant');
      expect(participant.status).toBe('needs-action');
    });
  });

  describe('createRecurrenceRule', () => {
    it('should create a recurrence rule with default values', () => {
      const rule = ModelFactory.createRecurrenceRule();

      expect(rule).toBeDefined();
      expect(rule.frequency).toBe('daily');
      expect(rule.interval).toBe(1);
    });
  });
});

describe('Fixtures', () => {
  describe('calendars', () => {
    it('should provide standard calendar fixtures', () => {
      expect(Fixtures.calendars.personal).toBeDefined();
      expect(Fixtures.calendars.personal.isDefault).toBe(true);

      expect(Fixtures.calendars.work).toBeDefined();
      expect(Fixtures.calendars.work.category).toBe('Work');

      expect(Fixtures.calendars.sharedReadOnly).toBeDefined();
      expect(Fixtures.calendars.sharedReadOnly.isReadOnly).toBe(true);
      expect(Fixtures.calendars.sharedReadOnly.permissions.canWrite).toBe(false);

      expect(Fixtures.calendars.sharedReadWrite).toBeDefined();
      expect(Fixtures.calendars.sharedReadWrite.isReadOnly).toBe(false);
      expect(Fixtures.calendars.sharedReadWrite.permissions.canWrite).toBe(true);
    });

    it('should provide all calendars as an array', () => {
      const calendars = Fixtures.getAllCalendars();
      expect(calendars).toHaveLength(4);
    });
  });

  describe('events', () => {
    it('should provide standard event fixtures', () => {
      expect(Fixtures.events.simple).toBeDefined();

      expect(Fixtures.events.allDay).toBeDefined();
      expect(Fixtures.events.allDay.isAllDay).toBe(true);

      expect(Fixtures.events.recurring).toBeDefined();
      expect(Fixtures.events.recurring.recurrenceRule).toBeDefined();

      expect(Fixtures.events.withParticipants).toBeDefined();
      expect(Fixtures.events.withParticipants.participants).toHaveLength(3);

      expect(Fixtures.events.adhd).toBeDefined();
      expect(Fixtures.events.adhd.adhdCategory).toBe('Focus Session');
      expect(Fixtures.events.adhd.focusPriority).toBe(8);
    });

    it('should provide all events as an array', () => {
      const events = Fixtures.getAllEvents();
      expect(events).toHaveLength(5);
    });
  });
});

describe('ConfigFactory', () => {
  it('should create a nextcloud config with default values', () => {
    const config = ConfigFactory.createNextcloudConfig();

    expect(config).toBeDefined();
    expect(config.baseUrl).toBe('https://nextcloud.example.com');
    expect(config.username).toBe('testuser');
    expect(config.appToken).toBe('test-token');
  });

  it('should override default values with provided ones', () => {
    const config = ConfigFactory.createNextcloudConfig({
      baseUrl: 'https://custom.example.com',
      username: 'customuser',
    });

    expect(config.baseUrl).toBe('https://custom.example.com');
    expect(config.username).toBe('customuser');
    expect(config.appToken).toBe('test-token'); // Not overridden
  });
});
