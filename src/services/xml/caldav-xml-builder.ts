/**
 * CalDAV XML Builder for calendar-specific XML operations
 */
import { XmlService } from './xml-service.js';
import { XmlDocumentBuilder } from './xml-document-builder.js';
import {
  CalendarDataOptions,
  CalendarProperties,
  CalDavResponse,
  ComponentFilter,
  FilterOptions,
  PropertyFilter,
  TimeRange,
} from './types.js';

/**
 * Builds CalDAV-specific XML requests
 */
export class CalDavXmlBuilder {
  private xmlService: XmlService;

  /**
   * Standard namespaces used in CalDAV requests
   */
  private static readonly NAMESPACES = {
    d: 'DAV:',
    c: 'urn:ietf:params:xml:ns:caldav',
    cs: 'http://calendarserver.org/ns/',
    oc: 'http://owncloud.org/ns',
    x1: 'http://apple.com/ns/ical/',
  };

  /**
   * Creates a new CalDAV XML builder
   *
   * @param xmlService XML service instance
   */
  constructor(xmlService: XmlService) {
    this.xmlService = xmlService;
  }

  /**
   * Builds a PROPFIND request for fetching calendar properties
   *
   * @param properties Array of property names to fetch (defaults to common properties)
   * @returns XML string for the PROPFIND request
   */
  buildPropfindRequest(properties?: string[]): string {
    // Use default properties if none provided
    const props = properties || [
      'd:resourcetype',
      'd:displayname',
      'cal:supported-calendar-component-set',
      'cs:getctag',
      'oc:calendar-enabled',
      'd:sync-token',
      'oc:owner-principal',
      'd:current-user-privilege-set',
      'oc:invite',
      'oc:calendar-order',
      'd:color',
    ];

    const doc = this.xmlService.createDocument('d:propfind', CalDavXmlBuilder.NAMESPACES);
    const propElement = doc.startElement('d:prop');

    for (const property of props) {
      propElement.addEmptyElement(property);
    }

    return doc.toString(true);
  }

  /**
   * Builds a MKCALENDAR request for creating a new calendar
   *
   * @param displayName The display name for the new calendar
   * @param color Optional color for the calendar
   * @returns XML string for the MKCALENDAR request
   */
  buildMkcalendarRequest(displayName: string, color?: string): string {
    const doc = this.xmlService.createDocument('c:mkcalendar', CalDavXmlBuilder.NAMESPACES);

    doc.startElement('c:set').startElement('c:prop').addElement('c:displayname', displayName);

    if (color) {
      doc.addElement('x1:calendar-color', color);
    }

    doc
      .endElement() // End c:prop
      .endElement(); // End c:set

    return doc.toString(true);
  }

  /**
   * Builds a PROPPATCH request for updating calendar properties
   *
   * @param properties Calendar properties to update
   * @returns XML string for the PROPPATCH request
   */
  buildProppatchRequest(properties: CalendarProperties): string {
    const doc = this.xmlService.createDocument('d:propertyupdate', {
      ...CalDavXmlBuilder.NAMESPACES,
      x2: 'http://owncloud.org/ns',
      x3: 'http://calendarserver.org/ns/',
    });

    doc.startElement('d:set').startElement('d:prop');

    if (properties.displayName !== undefined) {
      doc.addElement('d:displayname', properties.displayName);
    }

    if (properties.color !== undefined) {
      doc.addElement('x1:calendar-color', properties.color);
    }

    if (properties.category !== undefined) {
      doc.addElement('x2:calendar-category', properties.category);
    }

    if (properties.focusPriority !== undefined) {
      doc.addElement('x2:calendar-focus-priority', String(properties.focusPriority));
    }

    doc
      .endElement() // End d:prop
      .endElement(); // End d:set

    return doc.toString(true);
  }

  /**
   * Builds a REPORT request for fetching events within a time range
   *
   * @param timeRange Optional time range for the events
   * @param calendarDataOptions Options for the calendar-data element
   * @returns XML string for the REPORT request
   */
  buildCalendarQueryReport(
    timeRange?: TimeRange,
    calendarDataOptions?: CalendarDataOptions,
  ): string {
    // Default time range if not specified: +/- 6 months from current date
    let range: TimeRange | undefined = timeRange;
    if (!range) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 6, 0);
      range = { start, end };
    }

    const doc = this.xmlService.createDocument('c:calendar-query', CalDavXmlBuilder.NAMESPACES);

    // Build prop element
    doc.startElement('d:prop').addEmptyElement('d:getetag');

    // Calendar data element
    if (calendarDataOptions?.expand) {
      doc
        .startElement('c:calendar-data')
        .startElement('c:expand')
        .addAttribute('start', this.xmlService.formatUTCDate(calendarDataOptions.expand.start))
        .addAttribute('end', this.xmlService.formatUTCDate(calendarDataOptions.expand.end))
        .endElement() // End c:expand
        .endElement(); // End c:calendar-data
    } else {
      doc.addEmptyElement('c:calendar-data');
    }

    doc.endElement(); // End d:prop

    // Build filter element
    doc
      .startElement('c:filter')
      .startElement('c:comp-filter')
      .addAttribute('name', 'VCALENDAR')
      .startElement('c:comp-filter')
      .addAttribute('name', 'VEVENT');

    if (range) {
      doc
        .startElement('c:time-range')
        .addAttribute('start', this.xmlService.formatUTCDate(range.start))
        .addAttribute('end', this.xmlService.formatUTCDate(range.end))
        .endElement(); // End c:time-range
    }

    doc
      .endElement() // End c:comp-filter (VEVENT)
      .endElement() // End c:comp-filter (VCALENDAR)
      .endElement(); // End c:filter

    return doc.toString(true);
  }

  /**
   * Builds a filter for fetching a specific event by UID
   *
   * @param uid The UID of the event to fetch
   * @returns XML string for the calendar-query REPORT request
   */
  buildEventByUidRequest(uid: string): string {
    const doc = this.xmlService.createDocument('c:calendar-query', CalDavXmlBuilder.NAMESPACES);

    // Build prop element
    doc
      .startElement('d:prop')
      .addEmptyElement('d:getetag')
      .addEmptyElement('c:calendar-data')
      .endElement(); // End d:prop

    // Build filter element with UID filter
    doc
      .startElement('c:filter')
      .startElement('c:comp-filter')
      .addAttribute('name', 'VCALENDAR')
      .startElement('c:comp-filter')
      .addAttribute('name', 'VEVENT')
      .startElement('c:prop-filter')
      .addAttribute('name', 'UID')
      .startElement('c:text-match')
      .addAttribute('collation', 'i;unicode-casemap')
      .setContent(uid)
      .endElement() // End c:text-match
      .endElement() // End c:prop-filter
      .endElement() // End c:comp-filter (VEVENT)
      .endElement() // End c:comp-filter (VCALENDAR)
      .endElement(); // End c:filter

    return doc.toString(true);
  }

  /**
   * Builds a request to expand recurring events
   *
   * @param eventUrls Array of event URLs to fetch
   * @param start Start date for expansion
   * @param end End date for expansion
   * @returns XML string for the calendar-multiget REPORT request
   */
  buildExpandRecurringEventsRequest(eventUrls: string[], start: Date, end: Date): string {
    const doc = this.xmlService.createDocument('c:calendar-multiget', CalDavXmlBuilder.NAMESPACES);

    // Build prop element with expand option
    doc
      .startElement('d:prop')
      .addEmptyElement('d:getetag')
      .startElement('c:calendar-data')
      .startElement('c:expand')
      .addAttribute('start', this.xmlService.formatUTCDate(start))
      .addAttribute('end', this.xmlService.formatUTCDate(end))
      .endElement() // End c:expand
      .endElement() // End c:calendar-data
      .endElement(); // End d:prop

    // Add href elements
    for (const url of eventUrls) {
      doc.addElement('d:href', url);
    }

    return doc.toString(true);
  }

  /**
   * Builds an advanced calendar-query with custom filter options
   *
   * @param filterOptions Filter options for the query
   * @returns XML string for the calendar-query REPORT request
   */
  buildAdvancedFilterRequest(filterOptions: FilterOptions): string {
    const doc = this.xmlService.createDocument('c:calendar-query', CalDavXmlBuilder.NAMESPACES);

    // Build prop element
    doc
      .startElement('d:prop')
      .addEmptyElement('d:getetag')
      .addEmptyElement('c:calendar-data')
      .endElement(); // End d:prop

    // Build filter element with custom filters
    doc.startElement('c:filter');

    // Add component filters
    for (const compFilter of filterOptions.componentFilters) {
      this.addComponentFilter(doc, compFilter);
    }

    doc.endElement(); // End c:filter

    return doc.toString(true);
  }

  /**
   * Helper method to recursively add component filters
   *
   * @param doc The XML document builder
   * @param compFilter The component filter to add
   */
  private addComponentFilter(doc: XmlDocumentBuilder, compFilter: ComponentFilter): void {
    // Start comp-filter element with name
    doc.startElement('c:comp-filter').addAttribute('name', compFilter.name);

    // Add test attribute if specified
    if (compFilter.test) {
      doc.addAttribute('test', compFilter.test);
    }

    // Add time-range if specified
    if (compFilter.timeRange) {
      doc
        .startElement('c:time-range')
        .addAttribute('start', this.xmlService.formatUTCDate(compFilter.timeRange.start))
        .addAttribute('end', this.xmlService.formatUTCDate(compFilter.timeRange.end))
        .endElement(); // End c:time-range
    }

    // Add property filters if specified
    if (compFilter.propFilters && compFilter.propFilters.length > 0) {
      for (const propFilter of compFilter.propFilters) {
        this.addPropertyFilter(doc, propFilter);
      }
    }

    // Add nested component filters if specified
    if (compFilter.compFilters && compFilter.compFilters.length > 0) {
      for (const nestedFilter of compFilter.compFilters) {
        this.addComponentFilter(doc, nestedFilter);
      }
    }

    doc.endElement(); // End c:comp-filter
  }

  /**
   * Helper method to add property filters
   *
   * @param doc The XML document builder
   * @param propFilter The property filter to add
   */
  private addPropertyFilter(doc: XmlDocumentBuilder, propFilter: PropertyFilter): void {
    // Start prop-filter element with name
    doc.startElement('c:prop-filter').addAttribute('name', propFilter.name);

    // Add test attribute if specified
    if (propFilter.test) {
      doc.addAttribute('test', propFilter.test);
    }

    // Add text-match if specified
    if (propFilter.textMatch) {
      doc
        .startElement('c:text-match')
        .addAttribute('collation', 'i;unicode-casemap')
        .setContent(propFilter.textMatch)
        .endElement(); // End c:text-match
    }

    doc.endElement(); // End c:prop-filter
  }

  /**
   * Parses a multistatus response from a CalDAV server
   *
   * @param xmlData The parsed XML data
   * @returns Array of CalDAV responses
   */
  parseMultistatus(xmlData: Record<string, unknown>): CalDavResponse[] {
    const multistatus = this.xmlService.getMultistatus(xmlData);
    if (!multistatus) {
      return [];
    }

    const responses = this.xmlService.getResponses(multistatus);
    return responses.map((response) => this.parseCalDavResponse(response));
  }

  /**
   * Parses a single response element from a multistatus response
   *
   * @param response The response element
   * @returns A CalDAV response object
   */
  private parseCalDavResponse(response: Record<string, unknown>): CalDavResponse {
    // Extract href
    let href = '';
    if (response['d:href']) {
      href = String(response['d:href']);
    } else if (response['href']) {
      href = String(response['href']);
    }

    // Extract status
    let status = '';
    if (response['d:status']) {
      status = String(response['d:status']);
    } else if (response['status']) {
      status = String(response['status']);
    }

    // Extract properties
    let properties: Record<string, unknown> = {};
    if (response['d:propstat']) {
      const propstat = response['d:propstat'];
      if (Array.isArray(propstat)) {
        // Find the propstat with status 200
        for (const ps of propstat) {
          const psStatus = ps['d:status'] || ps['status'];
          if (psStatus && String(psStatus).includes('200')) {
            properties = (ps['d:prop'] || ps['prop']) as Record<string, unknown>;
            break;
          }
        }
      } else if (typeof propstat === 'object' && propstat !== null) {
        properties = ((propstat as Record<string, unknown>)['d:prop'] ||
          (propstat as Record<string, unknown>)['prop']) as Record<string, unknown>;
      }
    } else if (response['propstat']) {
      const propstat = response['propstat'];
      if (Array.isArray(propstat)) {
        // Find the propstat with status 200
        for (const ps of propstat) {
          const psStatus = ps['d:status'] || ps['status'];
          if (psStatus && String(psStatus).includes('200')) {
            properties = (ps['d:prop'] || ps['prop']) as Record<string, unknown>;
            break;
          }
        }
      } else if (typeof propstat === 'object' && propstat !== null) {
        properties = ((propstat as Record<string, unknown>)['d:prop'] ||
          (propstat as Record<string, unknown>)['prop']) as Record<string, unknown>;
      }
    }

    return {
      href,
      status,
      properties,
    };
  }

  /**
   * Extracts calendar properties from a CalDAV response
   *
   * @param response The CalDAV response
   * @returns Object with extracted calendar properties
   */
  extractCalendarProperties(response: CalDavResponse): CalendarProperties {
    const properties: CalendarProperties = {};

    // Extract displayName
    if (response.properties['d:displayname']) {
      properties.displayName = String(response.properties['d:displayname']);
    } else if (response.properties['displayname']) {
      properties.displayName = String(response.properties['displayname']);
    }

    // Extract color
    if (response.properties['x1:calendar-color'] || response.properties['calendar-color']) {
      properties.color = String(
        response.properties['x1:calendar-color'] || response.properties['calendar-color'],
      );
    }

    // Extract category
    if (response.properties['x2:calendar-category'] || response.properties['calendar-category']) {
      properties.category = String(
        response.properties['x2:calendar-category'] || response.properties['calendar-category'],
      );
    }

    // Extract focus priority
    const focusPriority =
      response.properties['x2:calendar-focus-priority'] ||
      response.properties['calendar-focus-priority'];
    if (focusPriority !== undefined) {
      const priorityValue = Number(focusPriority);
      if (!isNaN(priorityValue)) {
        properties.focusPriority = priorityValue;
      }
    }

    return properties;
  }
}
