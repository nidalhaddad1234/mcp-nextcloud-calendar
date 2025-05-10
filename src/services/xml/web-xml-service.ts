/**
 * Web-based XML service for handling XML operations in Cloudflare Workers
 * Using fast-xml-parser for cross-platform compatibility
 */
import { XMLParser, XMLBuilder, XMLValidator } from 'fast-xml-parser';
import { createLogger } from '../logger.js';
import { ParseOptions, XmlParsingError } from './types.js';
import { WebXmlDocumentBuilder } from './web-xml-document-builder.js';

const logger = createLogger('WebXmlService');

// Default XML parsing options
const DEFAULT_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '$_',
  attributesGroupName: '$',
  textNodeName: '#text',
  cdataTagName: '#cdata',
  ignoreDeclaration: false,
  preserveOrder: true,
  parseTagValue: true,
  trimValues: true,
  parseAttributeValue: true,
  // Security options
  allowBooleanAttributes: true,
  isArray: (name: string, _jpath: string, _isLeafNode: boolean, _isAttribute: boolean) => {
    // Force arrays for specific elements that can appear multiple times
    if (
      /response$/.test(name) || 
      /href$/.test(name) || 
      /propstat$/.test(name)
    ) {
      return true;
    }
    return false;
  }
};

/**
 * Service for handling XML operations using fast-xml-parser
 * Designed for Cloudflare Workers compatibility
 */
export class WebXmlService {
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
   * Validates XML string before parsing
   * 
   * @param xmlString The XML string to validate
   * @returns Object with validation result and any error
   */
  validateXml(xmlString: string): { valid: boolean; error?: string } {
    const result = XMLValidator.validate(xmlString, {
      allowBooleanAttributes: true
    });
    
    if (result === true) {
      return { valid: true };
    }
    
    return { 
      valid: false, 
      error: typeof result === 'object' ? result.err.msg : 'Unknown XML validation error' 
    };
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
    options: ParseOptions = {},
  ): Promise<Record<string, unknown>> {
    // Merge default options with provided options
    const mergedOptions = {
      ...DEFAULT_PARSER_OPTIONS,
      ...options,
    };

    try {
      // Validate XML first
      const validation = this.validateXml(xmlString);
      if (!validation.valid) {
        throw new Error(`XML validation failed: ${validation.error}`);
      }

      // Create parser with merged options
      const parser = new XMLParser(mergedOptions);
      
      // Parse XML string
      const result = parser.parse(xmlString);
      
      // Return the parsed result
      return this.normalizeParserOutput(result);
    } catch (parseError) {
      // Get a snippet of the XML for error context (max 100 chars)
      const xmlSnippet = xmlString.length > 100 ? `${xmlString.substring(0, 100)}...` : xmlString;

      logger.warn('XML parsing failed:', parseError, `XML snippet: ${xmlSnippet}`);

      // If fallback is disabled, throw error immediately
      if (options.allowFallback === false) {
        throw new XmlParsingError(
          `XML parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          xmlString,
          options,
          parseError,
          false,
        );
      }

      // Try again with alternative options as fallback
      try {
        logger.info('Attempting fallback parsing with alternative options');
        const fallbackOptions = {
          ...DEFAULT_PARSER_OPTIONS,
          preserveOrder: false,
          ignoreAttributes: false,
          parseTagValue: false,
          processEntities: false,
          parseAttributeValue: false,
        };

        const fallbackParser = new XMLParser(fallbackOptions);
        const result = fallbackParser.parse(xmlString);
        
        return this.normalizeParserOutput(result);
      } catch (fallbackError) {
        // Both parsing attempts failed, throw comprehensive error
        throw new XmlParsingError(
          `XML parsing failed with primary and fallback options: ${
            fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
          }`,
          xmlString,
          options,
          fallbackError,
          true,
        );
      }
    }
  }

  /**
   * Normalizes parser output to match expected structure from legacy xml2js
   *
   * @param result The parsed XML result from fast-xml-parser
   * @returns Normalized result that matches xml2js format
   */
  private normalizeParserOutput(result: Record<string, unknown> | unknown[]): Record<string, unknown> {
    // If result is already in expected format, return it
    if (!Array.isArray(result)) {
      return result;
    }

    // Handle the preserved order format (array of objects with single key)
    const normalized: Record<string, unknown> = {};

    for (const item of result) {
      // Make sure item is an object
      if (typeof item !== 'object' || item === null) continue;

      // Each item should be an object with a single key
      const itemObj = item as Record<string, unknown>;
      const keys = Object.keys(itemObj);
      if (keys.length === 1) {
        const key = keys[0];
        const value = itemObj[key];
        
        // If the value is an array, process it recursively
        if (Array.isArray(value)) {
          normalized[key] = this.normalizeParserOutput(value);
        } else if (typeof value === 'object' && value !== null) {
          // Cast value to record for safe property access
          const valueObj = value as Record<string, unknown>;

          // If it's an object, check if it has text and attributes
          if (valueObj.hasOwnProperty('#text')) {
            if (valueObj.hasOwnProperty('$')) {
              // It has both text and attributes
              normalized[key] = {
                _: valueObj['#text'],
                $: this.normalizeAttributes(valueObj['$'] as Record<string, unknown>),
              };
            } else {
              // It just has text
              normalized[key] = valueObj['#text'];
            }
          } else if (valueObj.hasOwnProperty('$')) {
            // It just has attributes
            normalized[key] = {
              $: this.normalizeAttributes(valueObj['$'] as Record<string, unknown>),
            };
          } else {
            // It's a complex object, process recursively
            normalized[key] = this.normalizeParserOutput(valueObj);
          }
        } else {
          // It's a simple value
          normalized[key] = value;
        }
      }
    }
    
    return normalized;
  }

  /**
   * Normalizes attributes to match xml2js format
   * 
   * @param attributes The attributes object from fast-xml-parser
   * @returns Normalized attributes object
   */
  private normalizeAttributes(attributes: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    
    if (!attributes) return result;
    
    // Convert $_attribute format to just attribute
    for (const [key, value] of Object.entries(attributes)) {
      if (key.startsWith('$_')) {
        result[key.substring(2)] = String(value);
      } else {
        result[key] = String(value);
      }
    }
    
    return result;
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
  createDocument(rootElementName: string, namespaces?: Record<string, string>): WebXmlDocumentBuilder {
    return new WebXmlDocumentBuilder(this, rootElementName, namespaces);
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

  /**
   * Serializes a JavaScript object to XML string
   * 
   * @param jsObject JavaScript object to serialize
   * @param options Builder options
   * @returns XML string
   */
  serialize(jsObject: Record<string, unknown>, options: Record<string, unknown> = {}): string {
    // Define builder options with proper type information
    const builderOptions = {
      attributeNamePrefix: '$_',
      attributesGroupName: '$',
      textNodeName: '#text',
      format: true,
      ignoreAttributes: false,
      suppressEmptyNode: true,
      ...options
    };

    const builder = new XMLBuilder(builderOptions);
    
    return builder.build(jsObject);
  }
}