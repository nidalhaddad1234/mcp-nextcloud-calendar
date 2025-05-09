/**
 * Type definitions for XML handling
 */

/**
 * XML namespace definition
 */
export interface XmlNamespace {
  /**
   * XML namespace prefix
   */
  prefix: string;

  /**
   * XML namespace URI
   */
  uri: string;
}

/**
 * Options for XML parsing
 */
export interface ParseOptions {
  /**
   * Whether to normalize tag names
   */
  normalizeTags?: boolean;

  /**
   * Whether to create arrays for all elements
   */
  explicitArray?: boolean;

  /**
   * Whether to normalize attribute names
   */
  normalize?: boolean;

  /**
   * Whether to allow fallback parsing with alternative options
   */
  allowFallback?: boolean;

  /**
   * Whether to explicitly disable external entity expansion
   * Default: true (disables XXE for security)
   */
  disableEntityExpansion?: boolean;

  /**
   * Limit for entity expansion to prevent Billion Laughs attack
   * Default: 10000
   */
  entityExpansionLimit?: number;
}

/**
 * Custom error class for XML parsing failures
 */
export class XmlParsingError extends Error {
  /**
   * The original XML string that failed to parse
   */
  xmlString: string;

  /**
   * The options used for parsing
   */
  parseOptions: ParseOptions;

  /**
   * The original error that occurred during parsing
   */
  originalError: unknown;

  /**
   * Whether fallback parsing was attempted
   */
  fallbackAttempted: boolean;

  /**
   * Creates a new XML parsing error
   *
   * @param message Error message
   * @param xmlString Original XML string
   * @param parseOptions Options used for parsing
   * @param originalError Original error from parser
   * @param fallbackAttempted Whether fallback parsing was attempted
   */
  constructor(
    message: string,
    xmlString: string,
    parseOptions: ParseOptions,
    originalError: unknown,
    fallbackAttempted: boolean = false,
  ) {
    super(message);
    this.name = 'XmlParsingError';
    this.xmlString = xmlString;
    this.parseOptions = parseOptions;
    this.originalError = originalError;
    this.fallbackAttempted = fallbackAttempted;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, XmlParsingError);
    }
  }
}

/**
 * Response from a CalDAV request
 */
export interface CalDavResponse {
  /**
   * URL of the resource
   */
  href: string;

  /**
   * HTTP status code
   */
  status: string;

  /**
   * Resource properties
   */
  properties: Record<string, unknown>;
}

/**
 * Calendar properties for PROPPATCH requests
 */
export interface CalendarProperties {
  /**
   * Display name of the calendar
   */
  displayName?: string;

  /**
   * Color of the calendar (hex format)
   */
  color?: string;

  /**
   * ADHD-friendly visual category
   */
  category?: string;

  /**
   * ADHD focus priority level (1-10)
   */
  focusPriority?: number;
}

/**
 * Element in an XML document
 */
export interface XmlElement {
  /**
   * Element name
   */
  name: string;

  /**
   * Element attributes
   */
  attributes?: Record<string, string>;

  /**
   * Element content (text or child elements)
   */
  content?: string | XmlElement[];
}

/**
 * Type for time range parameters in CalDAV requests
 */
export interface TimeRange {
  /**
   * Start date of the range
   */
  start: Date;

  /**
   * End date of the range
   */
  end: Date;
}

/**
 * CalDAV property filter
 */
export interface PropertyFilter {
  /**
   * Property name
   */
  name: string;

  /**
   * Text to match within the property
   */
  textMatch?: string;

  /**
   * Filter test condition ('anyof' or 'allof')
   */
  test?: 'anyof' | 'allof';
}

/**
 * Component filter for CalDAV requests
 */
export interface ComponentFilter {
  /**
   * Component name (e.g., 'VEVENT', 'VCALENDAR')
   */
  name: string;

  /**
   * Time range filter
   */
  timeRange?: TimeRange;

  /**
   * Property filters
   */
  propFilters?: PropertyFilter[];

  /**
   * Nested component filters
   */
  compFilters?: ComponentFilter[];

  /**
   * Filter test condition ('anyof' or 'allof')
   */
  test?: 'anyof' | 'allof';
}

/**
 * Filter options for CalDAV REPORT requests
 */
export interface FilterOptions {
  /**
   * Component filters
   */
  componentFilters: ComponentFilter[];
}

/**
 * Options for calendar-data element in CalDAV requests
 */
export interface CalendarDataOptions {
  /**
   * Whether to expand recurring events
   */
  expand?: TimeRange;

  /**
   * Component names to include
   */
  components?: string[];

  /**
   * Properties to include
   */
  properties?: string[];
}
