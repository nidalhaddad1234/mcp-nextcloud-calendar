import { XmlService } from '../services/xml/xml-service.js';
import { CalDavXmlBuilder } from '../services/xml/caldav-xml-builder.js';

describe('CalDavXmlBuilder', () => {
  let xmlService: XmlService;
  let calDavXmlBuilder: CalDavXmlBuilder;

  beforeEach(() => {
    xmlService = new XmlService();
    calDavXmlBuilder = new CalDavXmlBuilder(xmlService);
  });

  describe('buildPropfindRequest', () => {
    it('should build a valid PROPFIND request with default properties', () => {
      const result = calDavXmlBuilder.buildPropfindRequest();

      // Test basic structure
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain(
        '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"',
      );

      // Test default properties
      expect(result).toContain('<d:resourcetype />');
      expect(result).toContain('<d:displayname />');
      expect(result).toContain('<oc:calendar-enabled />');
      expect(result).toContain('<d:sync-token />');
      expect(result).toContain('<d:current-user-privilege-set />');
    });

    it('should use custom properties when provided', () => {
      const customProps = ['d:displayname', 'd:resourcetype', 'c:calendar-data'];
      const result = calDavXmlBuilder.buildPropfindRequest(customProps);

      // Should contain custom properties
      expect(result).toContain('<d:displayname />');
      expect(result).toContain('<d:resourcetype />');
      expect(result).toContain('<c:calendar-data />');

      // Should not contain default properties not in the custom list
      expect(result).not.toContain('<oc:calendar-enabled />');
      expect(result).not.toContain('<d:sync-token />');
    });
  });

  describe('buildMkcalendarRequest', () => {
    it('should build a valid MKCALENDAR request with display name', () => {
      const displayName = 'New Calendar';
      const result = calDavXmlBuilder.buildMkcalendarRequest(displayName);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain(
        '<c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"',
      );
      expect(result).toContain('<c:displayname>New Calendar</c:displayname>');
    });

    it('should escape special characters in display name', () => {
      const displayName = '<My Calendar & Events>';
      const result = calDavXmlBuilder.buildMkcalendarRequest(displayName);

      expect(result).toContain('<c:displayname>&lt;My Calendar &amp; Events&gt;</c:displayname>');
    });

    it('should include color when provided', () => {
      const displayName = 'New Calendar';
      const color = '#FF0000';
      const result = calDavXmlBuilder.buildMkcalendarRequest(displayName, color);

      expect(result).toContain('<c:displayname>New Calendar</c:displayname>');
      expect(result).toContain('<x1:calendar-color>#FF0000</x1:calendar-color>');
    });
  });

  describe('buildProppatchRequest', () => {
    it('should build a valid PROPPATCH request with required properties', () => {
      const properties = {
        displayName: 'Updated Calendar',
        color: '#00FF00',
      };

      const result = calDavXmlBuilder.buildProppatchRequest(properties);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<d:propertyupdate xmlns:d="DAV:"');
      expect(result).toContain('<d:displayname>Updated Calendar</d:displayname>');
      expect(result).toContain('<x1:calendar-color>#00FF00</x1:calendar-color>');
    });

    it('should include ADHD-specific properties when provided', () => {
      const properties = {
        displayName: 'ADHD Calendar',
        color: '#0000FF',
        category: 'Work',
        focusPriority: 8,
      };

      const result = calDavXmlBuilder.buildProppatchRequest(properties);

      expect(result).toContain('<d:displayname>ADHD Calendar</d:displayname>');
      expect(result).toContain('<x1:calendar-color>#0000FF</x1:calendar-color>');
      expect(result).toContain('<x2:calendar-category>Work</x2:calendar-category>');
      expect(result).toContain('<x2:calendar-focus-priority>8</x2:calendar-focus-priority>');
    });

    it('should include only specified properties', () => {
      const properties = {
        color: '#00FF00',
      };

      const result = calDavXmlBuilder.buildProppatchRequest(properties);

      expect(result).toContain('<x1:calendar-color>#00FF00</x1:calendar-color>');
      expect(result).not.toContain('<d:displayname>');
      expect(result).not.toContain('<x2:calendar-category>');
      expect(result).not.toContain('<x2:calendar-focus-priority>');
    });
  });

  describe('buildCalendarQueryReport', () => {
    it('should build a valid calendar-query REPORT with default time range', () => {
      const result = calDavXmlBuilder.buildCalendarQueryReport();

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain(
        '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"',
      );
      expect(result).toContain('<d:prop>');
      expect(result).toContain('<d:getetag />');
      expect(result).toContain('<c:calendar-data />');
      expect(result).toContain('<c:filter>');
      expect(result).toContain('<c:comp-filter name="VCALENDAR">');
      expect(result).toContain('<c:comp-filter name="VEVENT">');
      expect(result).toContain('<c:time-range start="');
      expect(result).toContain('" end="');
    });

    it('should use custom time range when provided', () => {
      const timeRange = {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-12-31T23:59:59Z'),
      };

      const result = calDavXmlBuilder.buildCalendarQueryReport(timeRange);

      expect(result).toContain('<c:time-range start="20230101T000000Z" end="20231231T235959Z">');
    });

    it('should include expand option when provided', () => {
      const timeRange = {
        start: new Date('2023-01-01T00:00:00Z'),
        end: new Date('2023-12-31T23:59:59Z'),
      };

      const calendarDataOptions = {
        expand: timeRange,
      };

      const result = calDavXmlBuilder.buildCalendarQueryReport(timeRange, calendarDataOptions);

      expect(result).toContain('<c:calendar-data>');
      expect(result).toContain('<c:expand start="20230101T000000Z" end="20231231T235959Z">');
    });
  });

  describe('buildEventByUidRequest', () => {
    it('should build a valid request for fetching an event by UID', () => {
      const uid = 'event-123-456';
      const result = calDavXmlBuilder.buildEventByUidRequest(uid);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain(
        '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"',
      );
      expect(result).toContain('<c:prop-filter name="UID">');
      expect(result).toContain(
        '<c:text-match collation="i;unicode-casemap">event-123-456</c:text-match>',
      );
    });

    it('should escape special characters in UID', () => {
      const uid = 'event-123-<&>';
      const result = calDavXmlBuilder.buildEventByUidRequest(uid);

      expect(result).toContain(
        '<c:text-match collation="i;unicode-casemap">event-123-&lt;&amp;&gt;</c:text-match>',
      );
    });
  });

  describe('buildExpandRecurringEventsRequest', () => {
    it('should build a valid calendar-multiget request with expansion parameters', () => {
      const eventUrls = [
        '/calendars/user/calendar1/event1.ics',
        '/calendars/user/calendar1/event2.ics',
      ];
      const start = new Date('2023-01-01T00:00:00Z');
      const end = new Date('2023-12-31T23:59:59Z');

      const result = calDavXmlBuilder.buildExpandRecurringEventsRequest(eventUrls, start, end);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain(
        '<c:calendar-multiget xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"',
      );
      expect(result).toContain('<c:expand start="20230101T000000Z" end="20231231T235959Z">');
      expect(result).toContain('<d:href>/calendars/user/calendar1/event1.ics</d:href>');
      expect(result).toContain('<d:href>/calendars/user/calendar1/event2.ics</d:href>');
    });

    it('should escape special characters in URLs', () => {
      const eventUrls = ['/calendars/user/calendar & special/event.ics'];
      const start = new Date('2023-01-01T00:00:00Z');
      const end = new Date('2023-12-31T23:59:59Z');

      const result = calDavXmlBuilder.buildExpandRecurringEventsRequest(eventUrls, start, end);

      expect(result).toContain('<d:href>/calendars/user/calendar &amp; special/event.ics</d:href>');
    });
  });

  describe('parseMultistatus', () => {
    it('should parse a simple multistatus response', () => {
      const xmlData = {
        'd:multistatus': {
          'd:response': [
            {
              'd:href': '/calendars/user/calendar1/',
              'd:propstat': {
                'd:status': 'HTTP/1.1 200 OK',
                'd:prop': {
                  'd:displayname': 'My Calendar',
                },
              },
            },
          ],
        },
      };

      const result = calDavXmlBuilder.parseMultistatus(xmlData);

      expect(result).toHaveLength(1);
      expect(result[0].href).toBe('/calendars/user/calendar1/');
      expect(result[0].properties['d:displayname']).toBe('My Calendar');
    });

    it('should return empty array when no multistatus is found', () => {
      const xmlData = {
        other: 'data',
      };

      const result = calDavXmlBuilder.parseMultistatus(xmlData);

      expect(result).toEqual([]);
    });
  });

  describe('extractCalendarProperties', () => {
    it('should extract calendar properties from response', () => {
      const response: any = {
        href: '/calendars/user/calendar1/',
        status: 'HTTP/1.1 200 OK',
        properties: {
          'd:displayname': 'Work Calendar',
          'x1:calendar-color': '#FF0000',
          'x2:calendar-category': 'Work',
          'x2:calendar-focus-priority': '7',
        },
      };

      const result = calDavXmlBuilder.extractCalendarProperties(response);

      expect(result.displayName).toBe('Work Calendar');
      expect(result.color).toBe('#FF0000');
      expect(result.category).toBe('Work');
      expect(result.focusPriority).toBe(7);
    });

    it('should handle normalized property names', () => {
      const response: any = {
        href: '/calendars/user/calendar1/',
        status: 'HTTP/1.1 200 OK',
        properties: {
          displayname: 'Work Calendar',
          'calendar-color': '#FF0000',
          'calendar-category': 'Work',
          'calendar-focus-priority': '7',
        },
      };

      const result = calDavXmlBuilder.extractCalendarProperties(response);

      expect(result.displayName).toBe('Work Calendar');
      expect(result.color).toBe('#FF0000');
      expect(result.category).toBe('Work');
      expect(result.focusPriority).toBe(7);
    });

    it('should handle missing properties', () => {
      const response: any = {
        href: '/calendars/user/calendar1/',
        status: 'HTTP/1.1 200 OK',
        properties: {
          'd:displayname': 'Work Calendar',
        },
      };

      const result = calDavXmlBuilder.extractCalendarProperties(response);

      expect(result.displayName).toBe('Work Calendar');
      expect(result.color).toBeUndefined();
      expect(result.category).toBeUndefined();
      expect(result.focusPriority).toBeUndefined();
    });
  });
});
