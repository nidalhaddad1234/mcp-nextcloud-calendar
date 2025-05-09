/**
 * Tests for the model factory utilities
 */
import { ModelFactory } from './utils/model-factory.js';

describe('ModelFactory', () => {
  describe('createCalendar', () => {
    it('should create a calendar with default values', () => {
      const calendar = ModelFactory.createCalendar();
      
      // Check that all required fields are present
      expect(calendar.id).toBeDefined();
      expect(calendar.displayName).toBeDefined();
      expect(calendar.owner).toBeDefined();
      expect(calendar.permissions).toBeDefined();
      
      // Check default permissions
      expect(calendar.permissions.canRead).toBe(true);
      expect(calendar.isReadOnly).toBe(false);
    });
    
    it('should override default values with provided properties', () => {
      const calendar = ModelFactory.createCalendar({
        id: 'custom-id',
        displayName: 'Custom Calendar',
        color: '#FF0000',
        isReadOnly: true
      });
      
      expect(calendar.id).toBe('custom-id');
      expect(calendar.displayName).toBe('Custom Calendar');
      expect(calendar.color).toBe('#FF0000');
      expect(calendar.isReadOnly).toBe(true);
      
      // Non-overridden properties should still have defaults
      expect(calendar.owner).toBeDefined();
    });
  });
  
  describe('createCalendars', () => {
    it('should create multiple calendars with unique IDs', () => {
      const count = 3;
      const calendars = ModelFactory.createCalendars(count);

      expect(calendars).toHaveLength(count);

      // Verify IDs are unique
      const ids = calendars.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(count);
    });

    it('should apply overrides to all created calendars', () => {
      const calendars = ModelFactory.createCalendars(2, () => ({
        color: '#00FF00',
        isShared: true
      }));

      expect(calendars[0].color).toBe('#00FF00');
      expect(calendars[0].isShared).toBe(true);
      expect(calendars[1].color).toBe('#00FF00');
      expect(calendars[1].isShared).toBe(true);
    });
  });
  
  describe('createEvent', () => {
    it('should create an event with default values', () => {
      const event = ModelFactory.createEvent();
      
      // Check required fields
      expect(event.id).toBeDefined();
      expect(event.calendarId).toBeDefined();
      expect(event.title).toBeDefined();
      expect(event.start).toBeInstanceOf(Date);
      expect(event.end).toBeInstanceOf(Date);
    });
    
    it('should override default values with provided properties', () => {
      const start = new Date('2025-01-01T09:00:00Z');
      const end = new Date('2025-01-01T10:00:00Z');
      
      const event = ModelFactory.createEvent({
        id: 'custom-event',
        title: 'Important Meeting',
        start,
        end,
        isAllDay: true
      });
      
      expect(event.id).toBe('custom-event');
      expect(event.title).toBe('Important Meeting');
      expect(event.start).toEqual(start);
      expect(event.end).toEqual(end);
      expect(event.isAllDay).toBe(true);
    });
  });
  
  describe('createEvents', () => {
    it('should create multiple events with unique IDs', () => {
      const count = 3;
      const events = ModelFactory.createEvents(count);

      expect(events).toHaveLength(count);

      // Verify IDs are unique
      const ids = events.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(count);
    });

    it('should apply overrides to all created events', () => {
      const calendarId = 'test-calendar';
      const events = ModelFactory.createEvents(2, () => ({
        calendarId,
        isAllDay: true
      }));

      expect(events[0].calendarId).toBe(calendarId);
      expect(events[0].isAllDay).toBe(true);
      expect(events[1].calendarId).toBe(calendarId);
      expect(events[1].isAllDay).toBe(true);
    });
  });
  
  describe('createParticipant', () => {
    it('should create a participant with default values', () => {
      const participant = ModelFactory.createParticipant();

      expect(participant.email).toBeDefined();
      expect(participant.name).toBeDefined();
      expect(participant.role).toBeDefined();
      expect(participant.status).toBeDefined();
    });

    it('should override default values with provided properties', () => {
      const participant = ModelFactory.createParticipant({
        email: 'test@example.com',
        name: 'Test User',
        role: 'required',
        status: 'accepted'
      });

      expect(participant.email).toBe('test@example.com');
      expect(participant.name).toBe('Test User');
      expect(participant.role).toBe('required');
      expect(participant.status).toBe('accepted');
    });
  });
});