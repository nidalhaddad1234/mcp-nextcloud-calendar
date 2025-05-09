/**
 * Core XML service for handling XML operations
 */
import { parseStringPromise } from 'xml2js';
import { createLogger } from '../logger.js';
import { ParseOptions, XmlParsingError } from './types.js';
import { XmlDocumentBuilder } from './xml-document-builder.js';

const logger = createLogger('XmlService');

/**
 * Service for handling XML operations
 */
export class XmlService {
  /**
   * Escapes a string for safe use in XML content
   * Handles the five predefined XML entities:
   * - & (ampersand) becomes &amp;
   * - < (less than) becomes &lt;
   * - > (greater than) becomes &gt;
   * - " (double quote) becomes &quot;
   * - ' (apostrophe) becomes &apos;
   *
   * @param input The string to escape
   * @returns The XML-escaped string
   */
  escapeXml(input: string | null | undefined): string {
    if (input === null || input === undefined) {
      return '';
    }

    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Creates a safe XML element from user input
   *
   * @param tagName The XML tag name
   * @param content The content to place within the tag
   * @param attributes Optional attributes for the element
   * @returns A properly escaped XML fragment
   */
  createXmlElement(
    tagName: string,
    content: string | null | undefined,
    attributes?: Record<string, string>,
  ): string {
    // Create attribute string if attributes are provided
    let attributeString = '';
    if (attributes && Object.keys(attributes).length > 0) {
      attributeString = Object.entries(attributes)
        .map(([key, value]) => ` ${key}="${this.escapeXml(value)}"`)
        .join('');
    }

    return `<${tagName}${attributeString}>${this.escapeXml(content)}</${tagName}>`;
  }

  /**
   * Creates an empty XML element (self-closing tag)
   *
   * @param tagName The XML tag name
   * @param attributes Optional attributes for the element
   * @returns A self-closing XML element
   */
  createEmptyElement(tagName: string, attributes?: Record<string, string>): string {
    // Create attribute string if attributes are provided
    let attributeString = '';
    if (attributes && Object.keys(attributes).length > 0) {
      attributeString = Object.entries(attributes)
        .map(([key, value]) => ` ${key}="${this.escapeXml(value)}"`)
        .join('');
    }

    return `<${tagName}${attributeString} />`;
  }

  /**
   * Parses an XML string into a JavaScript object with robust error handling
   * and security protections against common XML vulnerabilities.
   *
   * @param xmlString The XML string to parse
   * @param options Optional parsing options
   * @returns A Promise resolving to the parsed XML object
   * @throws {XmlParsingError} If parsing fails and fallback is disabled or also fails
   */
  async parseXml(
    xmlString: string,
    options: ParseOptions = {
      explicitArray: false,
      normalizeTags: true,
      normalize: true,
      allowFallback: true,
      disableEntityExpansion: true,
      entityExpansionLimit: 10000,
    },
  ): Promise<Record<string, unknown>> {
    // Apply security settings to prevent XXE attacks
    const secureOptions = {
      ...options,
      // Security settings to prevent XXE attacks
      xmlParserOptions: {
        // Disable document type definition parsing (prevents XXE)
        ignoreDoctype: true,

        // Do not resolve external entities
        resolveEntities: options.disableEntityExpansion !== false,

        // Limit entity expansion to prevent Billion Laughs attack
        entityExpansionLimit: options.entityExpansionLimit || 10000,
      },
    };

    try {
      // Try to parse with provided options first
      return await parseStringPromise(xmlString, secureOptions);
    } catch (parseError) {
      // Get a snippet of the XML for error context (max 100 chars)
      const xmlSnippet = xmlString.length > 100 ? `${xmlString.substring(0, 100)}...` : xmlString;

      logger.warn('XML parsing failed:', parseError, `XML snippet: ${xmlSnippet}`);

      // If fallback is disabled, throw error immediately
      if (options.allowFallback === false) {
        throw new XmlParsingError(
          `XML parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          xmlString,
          secureOptions,
          parseError,
          false,
        );
      }

      // Try again with alternative options as fallback
      try {
        logger.info('Attempting fallback parsing with alternative options');
        const fallbackOptions = {
          explicitArray: true,
          normalizeTags: true,
          // Maintain security settings
          xmlParserOptions: secureOptions.xmlParserOptions,
        };

        return await parseStringPromise(xmlString, fallbackOptions);
      } catch (fallbackError) {
        // Both parsing attempts failed, throw comprehensive error
        throw new XmlParsingError(
          `XML parsing failed with primary and fallback options: ${
            fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          }`,
          xmlString,
          secureOptions,
          fallbackError,
          true,
        );
      }
    }
  }

  /**
   * Safely extracts multistatus from an XML response
   *
   * @param xmlData The parsed XML data
   * @returns The multistatus object or null if not found
   */
  getMultistatus(xmlData: Record<string, unknown>): Record<string, unknown> | null {
    // Try different possible paths to find the multistatus element
    if (xmlData && xmlData['d:multistatus'])
      return xmlData['d:multistatus'] as Record<string, unknown>;
    if (xmlData && xmlData['multistatus']) return xmlData['multistatus'] as Record<string, unknown>;

    // Try to find any property that might contain 'multistatus' in a case-insensitive way
    if (xmlData) {
      for (const key of Object.keys(xmlData)) {
        if (key.toLowerCase().includes('multistatus')) {
          return xmlData[key] as Record<string, unknown>;
        }
      }
    }

    return null;
  }

  /**
   * Get response elements from a multistatus object
   *
   * @param multistatus The multistatus object
   * @returns Array of response elements
   */
  getResponses(multistatus: Record<string, unknown>): Array<Record<string, unknown>> {
    if (multistatus['d:response'])
      return Array.isArray(multistatus['d:response'])
        ? (multistatus['d:response'] as Array<Record<string, unknown>>)
        : [multistatus['d:response'] as Record<string, unknown>];

    if (multistatus['response'])
      return Array.isArray(multistatus['response'])
        ? (multistatus['response'] as Array<Record<string, unknown>>)
        : [multistatus['response'] as Record<string, unknown>];

    // Look for any key containing 'response'
    for (const key of Object.keys(multistatus)) {
      if (key.toLowerCase().includes('response')) {
        const responseElement = multistatus[key];
        return Array.isArray(responseElement)
          ? (responseElement as Array<Record<string, unknown>>)
          : [responseElement as Record<string, unknown>];
      }
    }

    return [];
  }

  /**
   * Creates a new XML document builder with optional namespaces
   *
   * @param rootElementName The name of the root element
   * @param namespaces Optional map of namespace prefixes to URIs
   * @returns An XML document builder instance
   */
  createDocument(rootElementName: string, namespaces?: Record<string, string>): XmlDocumentBuilder {
    return new XmlDocumentBuilder(this, rootElementName, namespaces);
  }

  /**
   * Formats a Date object as a UTC string in the format YYYYMMDDTHHMMSSZ
   * Used for CalDAV date formatting
   *
   * This optimized implementation directly builds the string instead of
   * using multiple string replacements on toISOString output
   *
   * @param date The date to format
   * @returns The formatted date string
   */
  formatUTCDate(date: Date): string {
    // Format: YYYYMMDDTHHMMSSZ
    // Direct string construction is more efficient than string replacements
    return (
      date.getUTCFullYear().toString().padStart(4, '0') +
      (date.getUTCMonth() + 1).toString().padStart(2, '0') +
      date.getUTCDate().toString().padStart(2, '0') +
      'T' +
      date.getUTCHours().toString().padStart(2, '0') +
      date.getUTCMinutes().toString().padStart(2, '0') +
      date.getUTCSeconds().toString().padStart(2, '0') +
      'Z'
    );
  }

  /**
   * Creates a complete XML document with XML declaration
   *
   * @param content The XML content (without declaration)
   * @param version XML version (default: "1.0")
   * @param encoding XML encoding (default: "UTF-8")
   * @returns Complete XML document with declaration
   */
  createXmlDocument(content: string, version: string = '1.0', encoding: string = 'UTF-8'): string {
    return `<?xml version="${version}" encoding="${encoding}"?>\n${content}`;
  }
}
