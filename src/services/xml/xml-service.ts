/**
 * Core XML service for handling XML operations
 */
import { parseStringPromise } from 'xml2js';
import { createLogger } from '../logger.js';
import { ParseOptions } from './types.js';
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
   * Parses an XML string into a JavaScript object
   *
   * @param xmlString The XML string to parse
   * @param options Optional parsing options
   * @returns A Promise resolving to the parsed XML object
   */
  async parseXml(
    xmlString: string,
    options: ParseOptions = { explicitArray: false, normalizeTags: true, normalize: true },
  ): Promise<Record<string, unknown>> {
    try {
      // Try to parse with default options first
      return await parseStringPromise(xmlString, options);
    } catch (parseError) {
      logger.warn('Initial XML parsing failed, trying with alternative options:', parseError);
      // Try again with different options as fallback
      return await parseStringPromise(xmlString, {
        explicitArray: true,
        normalizeTags: true,
      });
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
   * @param date The date to format
   * @returns The formatted date string
   */
  formatUTCDate(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
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
