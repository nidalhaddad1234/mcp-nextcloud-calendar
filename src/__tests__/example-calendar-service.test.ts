/**
 * Example of using the unified testing approach for CalendarService
 */
import { jest } from '@jest/globals';
import { CalendarService } from '../services/calendar/calendar-service.js';
import {
  ConfigFactory,
  Fixtures,
  ModelFactory,
  XMLResponseFactory
} from './utils/index.js';

// Mock axios with a basic implementation
jest.mock('axios');

import axios from 'axios';

describe('CalendarService (Example of Unified Testing Approach)', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Set up base axios mock implementation
    axios.default = jest.fn().mockResolvedValue({ data: '', status: 200 });
    axios.isAxiosError = jest.fn().mockReturnValue(true);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      // Use the ConfigFactory to create a standard config
      const mockConfig = ConfigFactory.createNextcloudConfig();
      
      // We're just checking that the constructor doesn't throw
      const service = new CalendarService(mockConfig);
      expect(service).toBeDefined();
    });

    it('should throw error for incomplete config', () => {
      // Use the ConfigFactory with invalid overrides
      const invalidConfig = ConfigFactory.createNextcloudConfig({
        baseUrl: '',
        username: '',
        appToken: ''
      });

      expect(() => new CalendarService(invalidConfig))
        .toThrow('Nextcloud configuration is incomplete');
    });
  });

  describe('getCalendars', () => {
    it('should fetch and return calendars', async () => {
      // Use ConfigFactory to create a standard config
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Use Fixtures to get standard calendars
      const calendars = Fixtures.getAllCalendars();

      // Create axios mock response
      const mockResponse = {
        data: XMLResponseFactory.createPropfindResponse({
          calendars
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      };
      
      // Setup axios mock to return our response
      // For TypeScript, we need to cast axios to any
      (axios as any).mockResolvedValueOnce(mockResponse);
      
      // Call the method under test
      const result = await service.getCalendars();
      
      // Verify the results
      expect(result).toHaveLength(calendars.length);
      expect(result[0].id).toBe(calendars[0].id);
      expect(result[1].id).toBe(calendars[1].id);
    });

    it('should handle errors gracefully', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Simulate a server error
      const error = new Error('Server error');
      (error as any).response = {
        status: 500,
        statusText: 'Server error',
        data: XMLResponseFactory.createErrorResponse(500, 'Server error')
      };
      
      // Setup axios mock to reject with our error
      (axios as any).mockRejectedValueOnce(error);
      
      // Verify the method rejects with an error
      await expect(service.getCalendars()).rejects.toThrow(/Failed to fetch calendars/);
    });
  });

  describe('createCalendar', () => {
    it('should create a new calendar with required properties', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Use ModelFactory to create a new calendar request
      const newCalendarRequest = {
        displayName: 'New Calendar',
        color: '#00FF00',
        owner: '',
        isDefault: false,
        isShared: false,
        isReadOnly: false,
        permissions: {
          canRead: true,
          canWrite: true,
          canShare: true,
          canDelete: true
        }
      };
      
      // Mock the HTTP requests required for creation (sequence matters)
      // First MKCALENDAR request
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createMkcalendarResponse(),
        status: 201,
        headers: {},
        statusText: 'Created'
      });

      // Then PROPPATCH request
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createProppatchResponse(),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      // Call the method under test
      const result = await service.createCalendar(newCalendarRequest);
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.displayName).toBe(newCalendarRequest.displayName);
      expect(result.color).toBe(newCalendarRequest.color);
    });

    it('should throw an error if displayName is missing', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Use invalid calendar data
      const invalidCalendar = {
        displayName: '', // Missing display name
        color: '#00FF00',
        owner: '',
        isDefault: false,
        isShared: false,
        isReadOnly: false,
        permissions: {
          canRead: true,
          canWrite: true,
          canShare: true,
          canDelete: true
        }
      };
      
      // No HTTP mocks needed as validation should fail before any requests
      
      // Verify the method rejects with an error
      await expect(service.createCalendar(invalidCalendar))
        .rejects.toThrow('Calendar display name is required');
    });
  });

  describe('updateCalendar', () => {
    it('should update an existing calendar', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Use Fixtures for a standard calendar collection
      const calendars = Fixtures.getAllCalendars();
      
      // Mock the sequence of requests for an update
      // First getCalendars to verify existence
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createPropfindResponse({
          calendars
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });

      // Then PROPPATCH request
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createProppatchResponse(),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      // Define updates
      const updates = {
        displayName: 'Updated Calendar',
        color: '#0000FF'
      };
      
      // Call the method under test
      const result = await service.updateCalendar('personal', updates);
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.id).toBe('personal');
      expect(result.displayName).toBe(updates.displayName);
      expect(result.color).toBe(updates.color);
    });

    it('should throw an error if calendar is not found', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Mock getCalendars to return an empty array (no calendars found)
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createPropfindResponse({
          calendars: []
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      // Call the method with a non-existent calendar ID
      await expect(service.updateCalendar('non-existent', { displayName: 'Test' }))
        .rejects.toThrow(/Calendar with ID non-existent not found/);
    });

    it('should throw an error if user lacks permission', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Use a read-only calendar from fixtures
      const readOnlyCalendar = [Fixtures.calendars.sharedReadOnly];
      
      // Mock the getCalendars call to return the read-only calendar
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createPropfindResponse({
          calendars: readOnlyCalendar
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      // Try to update the read-only calendar
      await expect(service.updateCalendar('shared-calendar', { displayName: 'Test' }))
        .rejects.toThrow(/You do not have permission to modify this calendar/);
    });
  });

  describe('deleteCalendar', () => {
    it('should delete an existing calendar', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Use work calendar (not default) from fixtures
      const calendars = [Fixtures.calendars.work];
      
      // Mock the sequence of requests for a deletion
      // First getCalendars
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createPropfindResponse({
          calendars
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });

      // Then DELETE request
      (axios as any).mockResolvedValueOnce({
        data: '',
        status: 204,
        headers: {},
        statusText: 'No Content'
      });
      
      // Call the method under test
      const result = await service.deleteCalendar('work');
      
      // Verify the result
      expect(result).toBe(true);
    });

    it('should throw an error if calendar is not found', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Mock getCalendars to return an empty array
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createPropfindResponse({
          calendars: []
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      // Call the method with a non-existent calendar ID
      await expect(service.deleteCalendar('non-existent'))
        .rejects.toThrow(/Calendar with ID non-existent not found/);
    });

    it('should throw an error if attempting to delete the default calendar', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Use the default calendar from fixtures
      const calendars = [Fixtures.calendars.personal]; // This is marked as default
      
      // Mock the getCalendars call
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createPropfindResponse({
          calendars
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      // Try to delete the default calendar
      await expect(service.deleteCalendar('personal'))
        .rejects.toThrow(/The default calendar cannot be deleted/);
    });

    it('should throw an error if user lacks delete permission', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Use a shared calendar without delete permission
      const calendars = [Fixtures.calendars.sharedReadOnly];
      
      // Mock the getCalendars call
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createPropfindResponse({
          calendars
        }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      // Try to delete a calendar without delete permission
      await expect(service.deleteCalendar('shared-calendar'))
        .rejects.toThrow(/You do not have permission to delete this calendar/);
    });
  });
});