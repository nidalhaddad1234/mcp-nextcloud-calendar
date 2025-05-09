# Calendar Service Testing Approach

This document explains the unified testing approach for the MCP Nextcloud Calendar service. It provides guidelines and examples for creating maintainable, consistent tests.

## Test Structure

Tests are organized into these major components:

1. **Model factories** - Create test instances of domain models
2. **XML response factories** - Generate XML responses for CalDAV operations
3. **HTTP mocking utilities** - Mock axios responses consistently
4. **Shared fixtures** - Common test data and scenarios
5. **Config factories** - Create test configurations

## Model Factories

Use the model factories to create test instances of calendars, events, etc. This provides consistently formatted test data:

```typescript
import { ModelFactory } from './__tests__/utils/model-factory';

// Create a calendar with default values
const calendar = ModelFactory.createCalendar();

// Create a calendar with specific overrides
const personalCalendar = ModelFactory.createCalendar({
  id: 'personal',
  displayName: 'Personal Calendar',
  isDefault: true
});

// Create multiple calendars
const calendars = ModelFactory.createCalendars(3);

// Create an event
const event = ModelFactory.createEvent();

// Create an event with specific details
const meeting = ModelFactory.createEvent({
  title: 'Weekly standup',
  isAllDay: false,
  start: new Date('2025-03-10T10:00:00Z'),
  end: new Date('2025-03-10T11:00:00Z'),
});
```

## XML Response Factories

The XML factories generate properly formatted CalDAV XML responses for various operations:

```typescript
import { XMLResponseFactory } from './__tests__/utils/xml-response-factory';

// Generate PROPFIND response for calendars
const propfindResponse = XMLResponseFactory.createPropfindResponse({
  calendars: calendars,
});

// Generate REPORT response for events
const reportResponse = XMLResponseFactory.createEventsReportResponse({
  events: events,
});

// Generate error response
const errorResponse = XMLResponseFactory.createErrorResponse(404, 'Calendar not found');
```

## HTTP Mocking

Use the HTTP mocking utilities to consistently mock axios responses:

```typescript
import { jest } from '@jest/globals';
import axios from 'axios';

// Mock axios first
jest.mock('axios');

// Then in your beforeEach setup
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  
  // Setup default response
  axios.default = jest.fn().mockResolvedValue({ data: '', status: 200 });
  axios.isAxiosError = jest.fn().mockReturnValue(true);
});

// In your test
(axios as any).mockResolvedValueOnce({
  data: XMLResponseFactory.createPropfindResponse({ calendars }),
  status: 207,
  headers: {},
  statusText: 'Multi-Status'
});

// Mock error
const error = new Error('Server error');
(error as any).response = {
  status: 500,
  statusText: 'Server error',
  data: XMLResponseFactory.createErrorResponse(500, 'Server error')
};
(axios as any).mockRejectedValueOnce(error);
```

## Shared Fixtures

For common test scenarios, use shared fixtures:

```typescript
import { Fixtures } from './__tests__/utils/fixtures';

// Get predefined calendars
const personal = Fixtures.calendars.personal;  // Default calendar
const work = Fixtures.calendars.work;          // Regular work calendar
const readOnly = Fixtures.calendars.readOnly;  // Read-only calendar

// Get all standard calendars
const allCalendars = Fixtures.getAllCalendars();

// Get predefined events
const allDayEvent = Fixtures.events.allDay;
const recurringEvent = Fixtures.events.recurring;
```

## Config Factory

Create test configurations:

```typescript
import { ConfigFactory } from './__tests__/utils/config-factory';

// Create a standard config for testing
const config = ConfigFactory.createNextcloudConfig();

// Create a config with specific overrides
const customConfig = ConfigFactory.createNextcloudConfig({
  baseUrl: 'https://custom.example.com',
  username: 'testuser',
  appToken: 'test-token'
});
```

## Best Practices for Tests

1. **Use factories consistently** - Avoid creating test data manually when factories are available
2. **Make tests focused** - Test one thing at a time
3. **Test behavior, not implementation** - Focus on the API, not internal details
4. **Use descriptive test names** - Tests should read like documentation
5. **Avoid test interdependence** - Tests should not rely on the state from other tests
6. **Mock at boundaries** - Mock external services like HTTP APIs, not internal components
7. **Verify the right things** - Check what matters, not implementation details
8. **Reset mocks between tests** - Each test should start with a clean state

## Example Test

Here's a complete example showing the unified approach:

```typescript
import { jest } from '@jest/globals';
import { CalendarService } from '../../services/calendar-service';
import {
  ConfigFactory,
  Fixtures,
  ModelFactory,
  XMLResponseFactory
} from '../utils';

// Mock axios first
jest.mock('axios');

import axios from 'axios';

describe('CalendarService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default response
    axios.default = jest.fn().mockResolvedValue({ data: '', status: 200 });
    axios.isAxiosError = jest.fn().mockReturnValue(true);
  });

  describe('getCalendars', () => {
    it('should fetch and return calendars', async () => {
      // Setup
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      const calendars = Fixtures.getAllCalendars();
      
      // Mock the response
      (axios as any).mockResolvedValueOnce({
        data: XMLResponseFactory.createPropfindResponse({ calendars }),
        status: 207,
        headers: {},
        statusText: 'Multi-Status'
      });
      
      // Execute
      const result = await service.getCalendars();
      
      // Verify
      expect(result).toHaveLength(calendars.length);
      expect(result[0].id).toBe(calendars[0].id);
    });

    it('should handle errors gracefully', async () => {
      // Setup
      const mockConfig = ConfigFactory.createNextcloudConfig();
      const service = new CalendarService(mockConfig);
      
      // Mock a server error
      const error = new Error('Server error');
      (error as any).response = {
        status: 500,
        statusText: 'Server error',
        data: XMLResponseFactory.createErrorResponse(500, 'Server error')
      };
      (axios as any).mockRejectedValueOnce(error);
      
      // Verify error handling
      await expect(service.getCalendars()).rejects.toThrow(/Failed to fetch calendars/);
    });
  });
});
```