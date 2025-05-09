# Testing Approach for MCP Nextcloud Calendar

This document provides an overview of the testing approach for the MCP Nextcloud Calendar project.

## Test Architecture

We have implemented a unified testing approach that includes:

1. **Model factories** - For creating test instances of domain models (Calendar, Event, etc.)
2. **XML response factories** - For generating CalDAV XML responses for various operations
3. **Mocking utilities** - For consistent HTTP request mocking
4. **Fixtures** - For common test data
5. **Config factories** - For testing configurations

## Key Components

### Model Factory

The `ModelFactory` creates test instances of domain models with sensible defaults:

```typescript
// Create a calendar with default values
const calendar = ModelFactory.createCalendar();

// Create a calendar with specific properties
const customCalendar = ModelFactory.createCalendar({
  id: 'personal',
  displayName: 'My Personal Calendar',
  isDefault: true
});

// Create multiple calendars
const calendars = ModelFactory.createCalendars(3);
```

### XML Response Factory

The `XMLResponseFactory` generates properly formatted CalDAV XML responses:

```typescript
// Generate PROPFIND response for calendars
const propfindResponse = XMLResponseFactory.createPropfindResponse({
  calendars: calendars
});

// Generate error response
const errorResponse = XMLResponseFactory.createErrorResponse(404, 'Not Found');
```

### HTTP Mocking

There are two approaches to mocking HTTP requests:

**Approach 1:** Using simple axios mocking (recommended)
```typescript
// Mock axios module
jest.mock('axios');

// In beforeEach
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();

  // Set up base axios mock implementation
  axios.default = jest.fn().mockResolvedValue({ data: '', status: 200 });
  axios.isAxiosError = jest.fn().mockReturnValue(true);
});

// In tests
(axios as any).mockResolvedValueOnce({
  data: XMLResponseFactory.createPropfindResponse({ calendars }),
  status: 207,
  headers: {},
  statusText: 'Multi-Status'
});
```

**Approach 2:** For more complex mocking, consider using a library like axios-mock-adapter.

### Fixtures

The `Fixtures` module provides common test data:

```typescript
// Get predefined calendars
const personal = Fixtures.calendars.personal;
const work = Fixtures.calendars.work;

// Get all standard calendars
const allCalendars = Fixtures.getAllCalendars();
```

### Config Factory

The `ConfigFactory` creates test configurations:

```typescript
// Create a standard config for tests
const config = ConfigFactory.createNextcloudConfig();

// Create a config with overrides
const customConfig = ConfigFactory.createNextcloudConfig({
  baseUrl: 'https://custom.nextcloud.com',
  username: 'testuser'
});
```

## Working Examples

The following tests demonstrate the key components of our testing approach:

1. `src/__tests__/model-factories.test.ts` - Tests the model factories and fixtures
2. `src/__tests__/xml-factory.test.ts` - Tests the XML response factory
3. `src/__tests__/model-factory.test.ts` - Tests the model factory implementation

## Best Practices

1. **Use factories consistently** - Prefer factory methods over manual object creation
2. **Reset mocks between tests** - Each test should start with a clean state
3. **Focus tests on behavior** - Test the API, not implementation details
4. **Use descriptive test names** - Tests should read like documentation
5. **Verify the right assertions** - Focus on what matters, not implementation details

## Notes on ESM and Jest

This project uses ES Modules (ESM), which requires some special handling with Jest:

- Jest's mocking API works differently with ESM modules
- Use `jest.mock('axios')` at the module level before importing axios
- For persistent issues, consider using a third-party library like axios-mock-adapter

## Documentation

For detailed examples and guidelines, see `src/__tests__/docs/README.md`.

## Migration Plan

1. ✅ Create core factory classes
2. ✅ Add test utilities and factories
3. ✅ Create example tests for the factories
4. ✅ Add documentation with testing guidelines
5. ⬜ Gradually migrate existing tests to the new approach

## Benefits

- More maintainable tests
- Less brittle tests that focus on behavior, not implementation
- Consistent test data generation
- Better handling of edge cases and errors
- Easier to write new tests