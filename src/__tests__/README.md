# Testing Guidelines for MCP Calendar Service

This document outlines the preferred testing approach for the MCP Calendar Service codebase.

## Testing Philosophy

1. **Focus on behavior, not implementation** - Test what functions do, not how they do it
2. **Predictable and repeatable** - Tests should yield the same result every time
3. **Fast and independent** - Tests should run quickly and not depend on other tests
4. **Comprehensive coverage** - Cover edge cases and error conditions
5. **Maintainable** - Tests should be easy to update when the codebase changes

## Test Types

### Unit Tests

- Test a single function or class in isolation
- Mock dependencies at the boundary of the unit
- Focus on specific functionality and edge cases

Example: Testing the `CalendarService.updateCalendar()` method with mocked HTTP client responses.

### Integration Tests

- Test multiple components working together
- Mock external dependencies (HTTP, databases)
- Focus on verifying interactions between components

Example: Testing calendar creation and event management workflow across services.

### API Tests

- Test HTTP endpoints through handler functions
- Mock service layers when needed
- Focus on request/response structure and validation

Example: Testing the `/api/calendars` endpoint's behavior with mocked service responses.

## Test Utilities

The `./utils` directory contains reusable utilities for testing:

### Model Factory (`model-factory.ts`)

Creates test instances of models with sensible defaults:

```typescript
// Create a standard test calendar
const calendar = ModelFactory.createCalendar();

// Create with specific overrides
const customCalendar = ModelFactory.createCalendar({
  id: 'custom-id',
  isDefault: true
});

// Create multiple instances
const calendars = ModelFactory.createCalendars(3);
```

### XML Response Factory (`xml-response-factory.ts`)

Generates XML responses for CalDAV operations:

```typescript
// Create a PROPFIND response with calendars
const xmlResponse = XMLResponseFactory.createPropfindResponse({
  calendars: [calendar1, calendar2]
});

// Create an events report response
const eventsResponse = XMLResponseFactory.createEventsReportResponse({
  events: [event1, event2]
});
```

### HTTP Mock (`http-mock.ts`)

Provides utilities for mocking axios HTTP responses:

```typescript
// Reset mocks before each test
beforeEach(() => {
  HttpMock.reset();
});

// Mock a successful calendar fetch
HttpMock.mockSuccessfulCalendarFetch(calendars);

// Mock an error response
HttpMock.mockError(404, 'Calendar not found');
```

### Config Factory (`config-factory.ts`)

Creates configuration objects for testing:

```typescript
// Create a standard Nextcloud config
const config = ConfigFactory.createNextcloudConfig();

// Create with overrides
const customConfig = ConfigFactory.createNextcloudConfig({
  baseUrl: 'https://custom.example.com'
});
```

### Fixtures (`fixtures.ts`)

Provides standard test data for common scenarios:

```typescript
// Get a personal calendar with full permissions
const personalCalendar = Fixtures.calendars.personal;

// Get a read-only shared calendar
const readOnlyCalendar = Fixtures.calendars.sharedReadOnly;

// Get an event with participants
const meetingEvent = Fixtures.events.withParticipants;
```

## Best Practices

### Mocking HTTP Requests

Always mock at the HTTP level (axios) rather than replacing service methods:

```typescript
// GOOD: Mock at the HTTP boundary
HttpMock.mockSuccessfulCalendarFetch(calendars);
const result = await service.getCalendars();

// BAD: Replace the method implementation
service.getCalendars = async () => calendars;
const result = await service.getCalendars();
```

### Testing Error Handling

Always include test cases for error conditions:

```typescript
it('should handle errors gracefully', async () => {
  HttpMock.mockError(500, 'Server error');
  await expect(service.getCalendars()).rejects.toThrow(/Failed to fetch calendars/);
});
```

### Test Organization

Organize tests by feature and behavior:

```typescript
describe('CalendarService', () => {
  describe('getCalendars', () => {
    it('should return calendars when fetch is successful', async () => {
      // Test successful case
    });
    
    it('should throw an error when fetch fails', async () => {
      // Test error case
    });
  });
});
```

### Testing Asynchronous Code

Use `async`/`await` for all asynchronous tests:

```typescript
it('should fetch calendars asynchronously', async () => {
  // Setup mocks
  HttpMock.mockSuccessfulCalendarFetch(calendars);
  
  // Await the result
  const result = await service.getCalendars();
  
  // Make assertions
  expect(result).toHaveLength(2);
});
```

## Example Tests

See these files for examples of the recommended testing approach:

1. `example-calendar-service.test.ts` - Unit test example
2. `integration/calendar-integration.test.ts` - Integration test example

## Running Tests

```bash
# Run all tests
npm run test

# Run a specific test file
npm run test -- calendar-service.test.ts

# Run tests with coverage report
npm run test -- --coverage
```