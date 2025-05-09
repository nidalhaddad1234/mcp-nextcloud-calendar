/**
 * Simple calendar service test to demonstrate the unified testing approach
 */
import { jest } from '@jest/globals';
import { CalendarService } from '../services/calendar/calendar-service.js';
import { ConfigFactory, XMLResponseFactory } from './utils/index.js';

// Mock axios with a basic implementation
jest.mock('axios');

import axios from 'axios';

describe('CalendarService Simple Test', () => {
  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

    // No need to mock here - jest-setup.test.js handles this
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
        appToken: '',
      });

      expect(() => new CalendarService(invalidConfig)).toThrow(
        'Nextcloud configuration is incomplete',
      );
    });
  });

  describe('getCalendars', () => {
    it('should handle errors gracefully', async () => {
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);

      // Simulate a server error
      const error = new Error('Server error');
      (error as any).response = {
        status: 500,
        statusText: 'Server error',
        data: XMLResponseFactory.createErrorResponse(500, 'Server error'),
      };

      // Set up the mock to throw the error
      (axios as unknown as jest.Mock).mockRejectedValueOnce(error);

      // Verify the method rejects with an error
      await expect(service.getCalendars()).rejects.toThrow(/Failed to fetch calendars/);
    });
  });
});
