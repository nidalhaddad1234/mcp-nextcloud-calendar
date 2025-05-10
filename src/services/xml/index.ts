/**
 * XML Services module
 * Provides a consistent API for XML processing with support for both
 * Node.js environments and Cloudflare Workers
 */

import { XmlService } from './xml-service.js';
import { WebXmlService } from './web-xml-service.js';
import { CalDavXmlBuilder } from './caldav-xml-builder.js';
import { WebCalDavXmlBuilder } from './web-caldav-xml-builder.js';
import { XmlDocumentBuilder } from './xml-document-builder.js';
import { WebXmlDocumentBuilder } from './web-xml-document-builder.js';
import { XmlSecurity } from './xml-security.js';
import { ParseOptions, CalendarProperties, CalDavResponse, TimeRange } from './types.js';

/**
 * Environment detection
 * Determines whether code is running in a Cloudflare Workers environment
 */
export function isCloudflareWorkersEnvironment(): boolean {
  return (
    // Check for Cloudflare Workers environment
    typeof globalThis.caches !== 'undefined' &&
    typeof globalThis.addEventListener === 'function' &&
    typeof globalThis.fetch === 'function' &&
    typeof process === 'undefined'
  );
}

/**
 * Factory for creating XML services based on the environment
 */
export class XmlServiceFactory {
  /**
   * Creates an XML service appropriate for the current environment
   * 
   * @param forceWeb Force the use of web-based XML service
   * @returns An XML service instance
   */
  static createXmlService(forceWeb: boolean = false): XmlService | WebXmlService {
    if (forceWeb || isCloudflareWorkersEnvironment()) {
      return new WebXmlService();
    } else {
      return new XmlService();
    }
  }
  
  /**
   * Creates a CalDAV XML builder appropriate for the current environment
   * 
   * @param forceWeb Force the use of web-based CalDAV XML builder
   * @returns A CalDAV XML builder instance
   */
  static createCalDavXmlBuilder(forceWeb: boolean = false): CalDavXmlBuilder | WebCalDavXmlBuilder {
    const xmlService = this.createXmlService(forceWeb);
    
    if (forceWeb || isCloudflareWorkersEnvironment()) {
      return new WebCalDavXmlBuilder(xmlService as WebXmlService);
    } else {
      return new CalDavXmlBuilder(xmlService as XmlService);
    }
  }
}

/**
 * XML Service API
 * Provides a unified interface for XML operations regardless of environment
 */
export class XmlAPI {
  private xmlService: XmlService | WebXmlService;
  private caldavBuilder: CalDavXmlBuilder | WebCalDavXmlBuilder;
  
  /**
   * Creates a new XML API instance
   * 
   * @param forceWeb Force the use of web-based XML services
   */
  constructor(forceWeb: boolean = false) {
    this.xmlService = XmlServiceFactory.createXmlService(forceWeb);
    this.caldavBuilder = XmlServiceFactory.createCalDavXmlBuilder(forceWeb);
  }
  
  /**
   * Escapes a string for safe use in XML content
   * 
   * @param input The string to escape
   * @returns The XML-escaped string
   */
  escapeXml(input: string | null | undefined): string {
    return this.xmlService.escapeXml(input);
  }
  
  /**
   * Parses an XML string into a JavaScript object
   * 
   * @param xmlString The XML string to parse
   * @param options Optional parsing options
   * @returns A Promise resolving to the parsed XML object
   */
  async parseXml(
    xmlString: string,
    options?: ParseOptions
  ): Promise<Record<string, unknown>> {
    // Validate XML security before parsing
    const validation = XmlSecurity.validateXml(xmlString);
    if (!validation.valid) {
      // Sanitize the XML if it has security issues
      xmlString = XmlSecurity.sanitizeXml(xmlString);
    }
    
    return this.xmlService.parseXml(xmlString, options);
  }
  
  /**
   * Creates a new XML document builder
   * 
   * @param rootElementName The name of the root element
   * @param namespaces Optional map of namespace prefixes to URIs
   * @returns An XML document builder instance
   */
  createDocument(
    rootElementName: string,
    namespaces?: Record<string, string>
  ): XmlDocumentBuilder | WebXmlDocumentBuilder {
    return this.xmlService.createDocument(rootElementName, namespaces);
  }
  
  /**
   * Formats a Date object as a UTC string for CalDAV
   * 
   * @param date The date to format
   * @returns The formatted date string
   */
  formatUTCDate(date: Date): string {
    return this.xmlService.formatUTCDate(date);
  }
  
  /**
   * Builds a PROPFIND request for fetching calendar properties
   * 
   * @param properties Array of property names to fetch
   * @returns XML string for the PROPFIND request
   */
  buildPropfindRequest(properties?: string[]): string {
    return this.caldavBuilder.buildPropfindRequest(properties);
  }
  
  /**
   * Builds a MKCALENDAR request for creating a new calendar
   * 
   * @param displayName The display name for the new calendar
   * @param color Optional color for the calendar
   * @returns XML string for the MKCALENDAR request
   */
  buildMkcalendarRequest(displayName: string, color?: string): string {
    return this.caldavBuilder.buildMkcalendarRequest(displayName, color);
  }
  
  /**
   * Builds a PROPPATCH request for updating calendar properties
   * 
   * @param properties Calendar properties to update
   * @returns XML string for the PROPPATCH request
   */
  buildProppatchRequest(properties: CalendarProperties): string {
    return this.caldavBuilder.buildProppatchRequest(properties);
  }
  
  /**
   * Builds a REPORT request for fetching events within a time range
   * 
   * @param timeRange Optional time range for the events
   * @returns XML string for the REPORT request
   */
  buildCalendarQueryReport(timeRange?: TimeRange): string {
    return this.caldavBuilder.buildCalendarQueryReport(timeRange);
  }
  
  /**
   * Builds a filter for fetching a specific event by UID
   * 
   * @param uid The UID of the event to fetch
   * @returns XML string for the calendar-query REPORT request
   */
  buildEventByUidRequest(uid: string): string {
    return this.caldavBuilder.buildEventByUidRequest(uid);
  }
  
  /**
   * Parses a multistatus response from a CalDAV server
   * 
   * @param xmlData The parsed XML data
   * @returns Array of CalDAV responses
   */
  parseMultistatus(xmlData: Record<string, unknown>): CalDavResponse[] {
    return this.caldavBuilder.parseMultistatus(xmlData);
  }
  
  /**
   * Validates XML against security options
   * 
   * @param xmlString XML string to validate
   * @returns Validation result with potential issues
   */
  validateXml(xmlString: string): { valid: boolean; issues: string[] } {
    return XmlSecurity.validateXml(xmlString);
  }
  
  /**
   * Sanitizes XML to remove potentially dangerous content
   * 
   * @param xmlString XML string to sanitize
   * @returns Sanitized XML string
   */
  sanitizeXml(xmlString: string): string {
    return XmlSecurity.sanitizeXml(xmlString);
  }
}

// Export default instance for easy importing
export default new XmlAPI();

// Re-export the original classes for backward compatibility
export * from './types.js';
export * from './xml-service.js';
export * from './xml-document-builder.js';
export * from './caldav-xml-builder.js';
export * from './web-xml-service.js';
export * from './web-xml-document-builder.js';
export * from './web-caldav-xml-builder.js';
export { XmlSecurity };