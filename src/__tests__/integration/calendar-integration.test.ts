/**
 * Integration tests for the calendar subsystem
 */
import { jest } from '@jest/globals';

// Mock axios with a basic implementation
jest.mock('axios');

import axios from 'axios';
import { CalendarService } from '../../services/calendar/calendar-service.js';
import { EventService } from '../../services/calendar/event-service.js';
import {
  ConfigFactory,
  Fixtures,
  XMLResponseFactory
} from '../utils/index.js';

/**
 * This test file demonstrates a different testing approach focused on integration:
 * - Testing services together
 * - End-to-end scenarios that involve multiple calls
 * - Still isolating at the HTTP boundary with mocks
 */
describe('Calendar Subsystem Integration', () => {
  // Services we'll use throughout the tests
  let calendarService: CalendarService;
  let eventService: EventService;
  
  // Reset all mocks and create fresh services before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Set up base axios mock implementation
    axios.default = jest.fn().mockResolvedValue({ data: '', status: 200 });
    axios.isAxiosError = jest.fn().mockReturnValue(true);
    
    // Create services with the same configuration
    const config = ConfigFactory.createNextcloudConfig();
    calendarService = new CalendarService(config);
    eventService = new EventService(config);
  });

  describe('Calendar and Event Workflow', () => {
    it('should create a calendar and add events to it', async () => {
      // 1. Create a new calendar
      const newCalendarRequest = {
        displayName: 'Test Project',
        color: '#9C27B0',
        category: 'Projects',
        focusPriority: 7
      };
      
      // Mock the calendar creation sequence
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createMkcalendarResponse(),
        status: 201,
        headers: {},
        statusText: 'Created'
      });
      
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createProppatchResponse(),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      const calendar = await calendarService.createCalendar(newCalendarRequest);
      expect(calendar).toBeDefined();
      expect(calendar.id).toBeDefined();
      
      const calendarId = calendar.id;
      
      // 2. Create an event in the new calendar
      const newEvent = {
        title: 'Project Kickoff',
        description: 'Initial meeting to start the project',
        start: new Date('2025-06-01T10:00:00Z'),
        end: new Date('2025-06-01T11:00:00Z'),
        isAllDay: false,
        location: 'Conference Room A',
        adhdCategory: 'Meeting',
        focusPriority: 8
      };
      
      // Mock the event creation
      (axios as any).mockResolvedValueOnce({
        data: '',
        status: 201,
        headers: { etag: 'W/"etag123"' },
        statusText: 'Created'
      });
      
      const event = await eventService.createEvent(calendarId, newEvent);
      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.calendarId).toBe(calendarId);
      
      // 3. Fetch all events from the calendar
      // Mock the events report response with the created event
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createEventsReportResponse({
          events: [event]
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      const events = await eventService.getEvents(calendarId);
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe(newEvent.title);
      
      // 4. Update the event
      const eventId = event.id;
      const eventUpdates = {
        title: 'Project Kickoff (Updated)',
        location: 'Conference Room B'
      };
      
      // Mock the event update sequence (get, then update)
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createEventsReportResponse({
          events: [event]
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      (axios as any).mockResolvedValueOnce({
        data: '',
        status: 200,
        headers: { etag: 'W/"etag123"' },
        statusText: 'OK'
      });
      
      (axios as any).mockResolvedValueOnce({
        data: '',
        status: 201,
        headers: { etag: 'W/"etag456"' },
        statusText: 'Created'
      });
      
      const updatedEvent = await eventService.updateEvent(calendarId, eventId, eventUpdates);
      expect(updatedEvent.title).toBe(eventUpdates.title);
      expect(updatedEvent.location).toBe(eventUpdates.location);
      
      // 5. Delete the event
      // Mock the deletion sequence
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createEventsReportResponse({
          events: [updatedEvent]
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      (axios as any).mockResolvedValueOnce({
        data: '',
        status: 204,
        headers: {},
        statusText: 'No Content'
      });
      
      const deleteResult = await eventService.deleteEvent(calendarId, eventId);
      expect(deleteResult).toBe(true);
      
      // 6. Delete the calendar
      // Mock the calendar deletion sequence
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createPropfindResponse({
          calendars: [calendar]
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      (axios as any).mockResolvedValueOnce({
        data: '',
        status: 204,
        headers: {},
        statusText: 'No Content'
      });
      
      const calendarDeleteResult = await calendarService.deleteCalendar(calendarId);
      expect(calendarDeleteResult).toBe(true);
    });
  });

  describe('Error handling across services', () => {
    it('should propagate errors properly between services', async () => {
      // Set up services
      const config = ConfigFactory.createNextcloudConfig();
      const calendarService = new CalendarService(config);
      const eventService = new EventService(config);
      
      // Mock an authentication error
      const error = new Error('Unauthorized');
      (error as any).response = {
        status: 401,
        statusText: 'Unauthorized',
        data: XMLResponseFactory.createErrorResponse(401, 'Unauthorized')
      };
      (axios as any).mockRejectedValueOnce(error);
      
      // Verify both services handle the error properly
      await expect(calendarService.getCalendars()).rejects.toThrow(/Failed to fetch calendars/);
      
      // Reset and try with eventService
      jest.clearAllMocks();
      axios.default = jest.fn().mockResolvedValue({ data: '', status: 200 });
      axios.isAxiosError = jest.fn().mockReturnValue(true);
      
      const error2 = new Error('Unauthorized');
      (error2 as any).response = {
        status: 401,
        statusText: 'Unauthorized',
        data: XMLResponseFactory.createErrorResponse(401, 'Unauthorized')
      };
      (axios as any).mockRejectedValueOnce(error2);
      
      await expect(eventService.getEvents('test-calendar')).rejects.toThrow(/Failed to fetch events/);
    });
    
    it('should handle network errors consistently', async () => {
      // Set up services
      const config = ConfigFactory.createNextcloudConfig();
      const calendarService = new CalendarService(config);
      const eventService = new EventService(config);
      
      // Mock a network error
      const error = new Error('Network Error');
      (error as any).isAxiosError = true;
      (error as any).request = {}; // Request exists but no response
      (error as any).response = undefined;
      (axios as any).mockRejectedValueOnce(error);
      
      // Verify both services handle the error properly
      await expect(calendarService.getCalendars()).rejects.toThrow(/Failed to fetch calendars/);
      
      // Reset and try with eventService
      jest.clearAllMocks();
      axios.default = jest.fn().mockResolvedValue({ data: '', status: 200 });
      axios.isAxiosError = jest.fn().mockReturnValue(true);
      
      const error2 = new Error('Network Error');
      (error2 as any).isAxiosError = true;
      (error2 as any).request = {}; // Request exists but no response
      (error2 as any).response = undefined;
      (axios as any).mockRejectedValueOnce(error2);
      
      await expect(eventService.getEvents('test-calendar')).rejects.toThrow(/Failed to fetch events/);
    });
  });
});