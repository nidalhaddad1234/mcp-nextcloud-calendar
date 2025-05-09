/**
 * Factory for creating XML response strings for testing
 */
import { Calendar, Event } from '../../models/calendar.js';
import { XmlService } from '../../services/xml/index.js';

// Create a singleton instance of XmlService for use in this factory
const xmlService = new XmlService();

/**
 * Factory for creating XML responses for CalDAV operations
 */
export class XMLResponseFactory {
  /**
   * Create a PROPFIND response for calendars
   * @param options.calendars Calendars to include in the response
   * @param options.baseUrl Base URL for the server
   * @param options.username Username for paths
   * @returns XML string representing a PROPFIND response
   */
  static createPropfindResponse(options: {
    calendars: Calendar[];
    baseUrl?: string;
    username?: string;
  }): string {
    const baseUrl = options.baseUrl || 'https://nextcloud.example.com';
    const username = options.username || 'testuser';
    const caldavUrl = `${baseUrl}/remote.php/dav/calendars/${username}/`;

    let xmlResponse = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:oc="http://owncloud.org/ns">`;

    // Add parent response (calendar home)
    xmlResponse += `
  <d:response>
    <d:href>${caldavUrl}</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype>
          <d:collection/>
        </d:resourcetype>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`;

    // Add a response for each calendar
    for (const calendar of options.calendars) {
      const calendarUrl = `${caldavUrl}${calendar.id}/`;
      const isDefault = calendar.isDefault ? '1' : '0';
      const supportedComponents = '<comp name="VEVENT"/><comp name="VTODO"/>';

      xmlResponse += `
  <d:response>
    <d:href>${calendarUrl}</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype>
          <d:collection/>
          <cal:calendar/>
        </d:resourcetype>
        <d:displayname>${xmlService.escapeXml(calendar.displayName)}</d:displayname>
        <oc:calendar-enabled>1</oc:calendar-enabled>
        <cal:supported-calendar-component-set>${supportedComponents}</cal:supported-calendar-component-set>
        <oc:calendar-color>${xmlService.escapeXml(calendar.color)}</oc:calendar-color>
        <oc:owner-principal>principals/users/${xmlService.escapeXml(calendar.owner)}</oc:owner-principal>
        <cs:getctag>"${Date.now()}"</cs:getctag>
        <oc:is-default-calendar>${isDefault}</oc:is-default-calendar>`;

      if (calendar.category) {
        xmlResponse += `
        <oc:calendar-category>${xmlService.escapeXml(calendar.category)}</oc:calendar-category>`;
      }

      if (calendar.focusPriority !== null && calendar.focusPriority !== undefined) {
        xmlResponse += `
        <oc:calendar-focus-priority>${calendar.focusPriority}</oc:calendar-focus-priority>`;
      }

      xmlResponse += `
        <cal:read>${calendar.permissions.canRead ? '1' : '0'}</cal:read>
        <cal:write>${calendar.permissions.canWrite ? '1' : '0'}</cal:write>
        <cal:share>${calendar.permissions.canShare ? '1' : '0'}</cal:share>
        <cal:delete>${calendar.permissions.canDelete ? '1' : '0'}</cal:delete>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`;
    }

    xmlResponse += `
</d:multistatus>`;

    return xmlResponse;
  }

  /**
   * Create a REPORT response for events
   * @param options.events Events to include in the response
   * @param options.baseUrl Base URL for the server
   * @param options.username Username for paths
   * @returns XML string representing a REPORT response
   */
  static createEventsReportResponse(options: {
    events: Event[];
    baseUrl?: string;
    username?: string;
  }): string {
    const baseUrl = options.baseUrl || 'https://nextcloud.example.com';
    const username = options.username || 'testuser';

    let xmlResponse = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:oc="http://owncloud.org/ns">`;

    // Add a response for each event
    for (const event of options.events) {
      const caldavUrl = `${baseUrl}/remote.php/dav/calendars/${username}/`;
      const eventUrl = `${caldavUrl}${event.calendarId}/${event.id}.ics`;

      // Generate a simple iCalendar representation for testing
      const iCalData = this.createBasicICalForEvent(event);

      xmlResponse += `
  <d:response>
    <d:href>${eventUrl}</d:href>
    <d:propstat>
      <d:prop>
        <d:getetag>"${Date.now()}"</d:getetag>
        <cal:calendar-data>${xmlService.escapeXml(iCalData)}</cal:calendar-data>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>`;
    }

    xmlResponse += `
</d:multistatus>`;

    return xmlResponse;
  }

  /**
   * Create a basic iCalendar string for an event
   * @param event The event to convert to iCalendar format
   * @returns A basic iCalendar string
   */
  private static createBasicICalForEvent(event: Event): string {
    const formatDate = (date: Date) =>
      date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d+Z$/, 'Z');
    const startDate = formatDate(event.start);
    const endDate = formatDate(event.end);
    const createdDate = formatDate(event.created);
    const modifiedDate = formatDate(event.lastModified);

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nextcloud Calendar//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${event.id}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
DTSTART:${startDate}
DTEND:${endDate}
LOCATION:${event.location || ''}
ORGANIZER:mailto:${event.organizer || ''}
STATUS:${event.status || 'CONFIRMED'}
CREATED:${createdDate}
LAST-MODIFIED:${modifiedDate}
END:VEVENT
END:VCALENDAR`;
  }

  /**
   * Create a MKCALENDAR response (empty - just status code matters)
   * @returns Empty string (server returns empty body with 201 Created)
   */
  static createMkcalendarResponse(): string {
    return '';
  }

  /**
   * Create a PROPPATCH response (success)
   * @returns XML string representing a successful PROPPATCH response
   */
  static createProppatchResponse(): string {
    return `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:oc="http://owncloud.org/ns">
  <d:response>
    <d:href>/remote.php/dav/calendars/testuser/test-calendar/</d:href>
    <d:propstat>
      <d:prop>
        <d:displayname />
        <oc:calendar-color />
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;
  }

  /**
   * Create an error response
   * @param status HTTP status code
   * @param message Error message
   * @returns XML string representing an error response
   */
  static createErrorResponse(status: number, message: string): string {
    return `<?xml version="1.0"?>
<d:error xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">
  <s:message>${xmlService.escapeXml(message)}</s:message>
  <s:exception>Some\\Exception</s:exception>
</d:error>`;
  }
}
