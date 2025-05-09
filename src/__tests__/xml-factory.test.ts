/**
 * Tests for the XML response factory
 */
import { ModelFactory, XMLResponseFactory } from './utils/index.js';

describe('XMLResponseFactory', () => {
  describe('createPropfindResponse', () => {
    it('should generate a valid CalDAV PROPFIND response XML', () => {
      const calendars = ModelFactory.createCalendars(2);
      const response = XMLResponseFactory.createPropfindResponse({
        calendars,
      });

      // Check that it's a valid XML string
      expect(response).toContain('<?xml version="1.0"?>');
      expect(response).toContain('<d:multistatus');

      // Check that it contains calendar data
      expect(response).toContain('<d:displayname>Test Calendar 0</d:displayname>');
      expect(response).toContain('<d:displayname>Test Calendar 1</d:displayname>');
      expect(response).toContain('<cal:calendar/>');
      expect(response).toContain('<oc:calendar-color>#0082c9</oc:calendar-color>');
    });

    it('should include custom base URL and username when provided', () => {
      const calendars = [ModelFactory.createCalendar()];
      const response = XMLResponseFactory.createPropfindResponse({
        calendars,
        baseUrl: 'https://custom.example.com',
        username: 'customuser',
      });

      expect(response).toContain('https://custom.example.com');
      expect(response).toContain('customuser');
    });

    it('should handle special characters in displayName', () => {
      const calendar = ModelFactory.createCalendar({
        displayName: 'Calendar & <Tags>',
      });
      const response = XMLResponseFactory.createPropfindResponse({
        calendars: [calendar],
      });

      expect(response).toContain('Calendar &amp; &lt;Tags&gt;');
    });
  });

  describe('createEventsReportResponse', () => {
    it('should generate a valid CalDAV REPORT response XML for events', () => {
      const events = ModelFactory.createEvents(2);
      const response = XMLResponseFactory.createEventsReportResponse({
        events,
      });

      // Check that it's a valid XML string
      expect(response).toContain('<?xml version="1.0"?>');
      expect(response).toContain('<d:multistatus');

      // Check that it contains event data
      expect(response).toContain('<cal:calendar-data>');
      expect(response).toContain('BEGIN:VCALENDAR');
      expect(response).toContain('BEGIN:VEVENT');
      expect(response).toContain('test-event-0');
      expect(response).toContain('test-event-1');
    });
  });

  describe('createMkcalendarResponse', () => {
    it('should return an empty string (server returns empty response)', () => {
      const response = XMLResponseFactory.createMkcalendarResponse();
      expect(response).toBe('');
    });
  });

  describe('createProppatchResponse', () => {
    it('should generate a valid CalDAV PROPPATCH response XML', () => {
      const response = XMLResponseFactory.createProppatchResponse();

      expect(response).toContain('<?xml version="1.0"?>');
      expect(response).toContain('<d:multistatus');
      expect(response).toContain('<d:status>HTTP/1.1 200 OK</d:status>');
      expect(response).toContain('<d:displayname />');
    });
  });

  describe('createErrorResponse', () => {
    it('should generate a valid error response XML', () => {
      const response = XMLResponseFactory.createErrorResponse(404, 'Not Found');

      expect(response).toContain('<?xml version="1.0"?>');
      expect(response).toContain('<d:error');
      expect(response).toContain('<s:message>Not Found</s:message>');
    });

    it('should escape special characters in error messages', () => {
      const response = XMLResponseFactory.createErrorResponse(400, 'Invalid tag <tag>');

      expect(response).toContain('<s:message>Invalid tag &lt;tag&gt;</s:message>');
    });
  });
});
