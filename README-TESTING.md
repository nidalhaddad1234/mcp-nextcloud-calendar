# Unified Testing Approach for MCP Calendar Service

This project implements a standardized approach to testing the MCP Calendar Service.

## Overview

The testing utilities can be found in `src/__tests__/utils/` and include:

1. **ModelFactory**: Creates test instances of models (Calendar, Event, etc.)
2. **XMLResponseFactory**: Generates XML responses for CalDAV operations
3. **ConfigFactory**: Creates config objects for testing
4. **Fixtures**: Provides standard test data for common scenarios

## Working Examples

The following tests demonstrate the key components of our testing approach:

1. `src/__tests__/model-factories.test.ts` - Tests the model factories and fixtures functionality
2. `src/__tests__/xml-factory.test.ts` - Tests the XML response factory functionality

## HTTP Mocking Notes

Due to challenges with mocking axios in an ESM environment, we recommend either:

1. Using a manual approach to mock axios in your tests:
   ```typescript
   // Mock axios at the module level
   jest.mock('axios');

   // In your test
   (axios as jest.Mock).mockResolvedValueOnce({
     data: XMLResponseFactory.createPropfindResponse({ calendars }),
     status: 207
   });
   ```

2. Or using a library like `axios-mock-adapter` when writing actual service tests:
   ```typescript
   import MockAdapter from 'axios-mock-adapter';

   const mockAxios = new MockAdapter(axios);
   mockAxios.onGet(/\/calendars/).reply(200, responseData);
   ```

## Documentation

For comprehensive testing guidelines, see `src/__tests__/README.md`.

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