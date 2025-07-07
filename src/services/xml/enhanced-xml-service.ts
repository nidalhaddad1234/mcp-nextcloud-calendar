/**
 * Enhanced XML parsing service with better CalDAV support
 */
import { parseStringPromise } from 'xml2js';
import { createLogger } from '../logger.js';

const logger = createLogger('EnhancedXmlService');

/**
 * Enhanced XML service specifically for CalDAV responses
 */
export class EnhancedXmlService {
  /**
   * Parse CalDAV XML response with robust error handling
   */
  async parseCalDAVResponse(xmlString: string): Promise<unknown> {
    try {
      // Try standard parsing first
      const result = await parseStringPromise(xmlString, {
        explicitArray: false,
        normalizeTags: false,
        normalize: true,
        trim: true,
        mergeAttrs: false,
        attrkey: '@',
        charkey: '#',
        explicitCharkey: false,
      });

      return result;
    } catch (error) {
      logger.warn('Standard XML parsing failed, trying alternative approach', error);

      // Try with different options
      try {
        const fallbackResult = await parseStringPromise(xmlString, {
          explicitArray: true,
          normalizeTags: false,
          normalize: true,
          trim: true,
        });

        return fallbackResult;
      } catch (fallbackError) {
        logger.error('All XML parsing attempts failed', fallbackError);
        throw new Error(`Failed to parse CalDAV XML: ${fallbackError}`);
      }
    }
  }

  /**
   * Extract multistatus responses with better error handling
   */
  extractMultistatusResponses(
    xmlData: unknown,
  ): Array<{ href: string | null; status: string | null; properties: Record<string, unknown> }> {
    const responses: Array<{
      href: string | null;
      status: string | null;
      properties: Record<string, unknown>;
    }> = [];

    try {
      // Look for multistatus in various forms
      let multistatus = null;

      if (xmlData?.['d:multistatus']) {
        multistatus = xmlData['d:multistatus'];
      } else if (xmlData?.multistatus) {
        multistatus = xmlData.multistatus;
      } else if (xmlData?.['DAV:multistatus']) {
        multistatus = xmlData['DAV:multistatus'];
      } else {
        // Try to find any element containing multistatus
        for (const key in xmlData) {
          if (key.toLowerCase().includes('multistatus')) {
            multistatus = xmlData[key];
            break;
          }
        }
      }

      if (!multistatus) {
        logger.warn('No multistatus element found in XML response');
        return responses;
      }

      // Extract response elements
      let responseElements = null;

      if (multistatus['d:response']) {
        responseElements = multistatus['d:response'];
      } else if (multistatus.response) {
        responseElements = multistatus.response;
      } else if (multistatus['DAV:response']) {
        responseElements = multistatus['DAV:response'];
      } else {
        // Look for any response-like elements
        for (const key in multistatus) {
          if (key.toLowerCase().includes('response')) {
            responseElements = multistatus[key];
            break;
          }
        }
      }

      if (!responseElements) {
        logger.warn('No response elements found in multistatus');
        return responses;
      }

      // Ensure responseElements is an array
      const responseArray = Array.isArray(responseElements) ? responseElements : [responseElements];

      for (const response of responseArray) {
        const parsedResponse = this.parseResponse(response);
        if (parsedResponse) {
          responses.push(parsedResponse);
        }
      }

      logger.debug(`Extracted ${responses.length} responses from multistatus`);
      return responses;
    } catch (error) {
      logger.error('Error extracting multistatus responses', error);
      return responses;
    }
  }

  /**
   * Parse individual response element
   */
  private parseResponse(
    response: unknown,
  ): { href: string | null; status: string | null; properties: Record<string, unknown> } | null {
    try {
      const parsed: {
        href: string | null;
        status: string | null;
        properties: Record<string, unknown>;
      } = {
        href: null,
        status: null,
        properties: {},
      };

      // Extract href
      if (response['d:href']) {
        parsed.href = response['d:href'];
      } else if (response.href) {
        parsed.href = response.href;
      } else if (response['DAV:href']) {
        parsed.href = response['DAV:href'];
      }

      // Extract properties from propstat
      let propstat = null;
      if (response['d:propstat']) {
        propstat = response['d:propstat'];
      } else if (response.propstat) {
        propstat = response.propstat;
      } else if (response['DAV:propstat']) {
        propstat = response['DAV:propstat'];
      }

      if (propstat) {
        // Handle both single propstat and array of propstats
        const propstatArray = Array.isArray(propstat) ? propstat : [propstat];

        for (const ps of propstatArray) {
          // Check status - we want 200 OK responses
          let status = null;
          if (ps['d:status']) {
            status = ps['d:status'];
          } else if (ps.status) {
            status = ps.status;
          } else if (ps['DAV:status']) {
            status = ps['DAV:status'];
          }

          // Only process successful responses
          if (status && status.includes('200')) {
            // Extract properties
            let prop = null;
            if (ps['d:prop']) {
              prop = ps['d:prop'];
            } else if (ps.prop) {
              prop = ps.prop;
            } else if (ps['DAV:prop']) {
              prop = ps['DAV:prop'];
            }

            if (prop) {
              Object.assign(parsed.properties, prop);
            }
          }
        }
      }

      return parsed;
    } catch (error) {
      logger.warn('Error parsing individual response', error);
      return null;
    }
  }

  /**
   * Extract calendar data from properties
   */
  extractCalendarData(properties: Record<string, unknown>): string | null {
    try {
      // Look for calendar-data in various forms
      if (properties['cal:calendar-data']) {
        return properties['cal:calendar-data'];
      } else if (properties['calendar-data']) {
        return properties['calendar-data'];
      } else if (properties['c:calendar-data']) {
        return properties['c:calendar-data'];
      } else if (properties['urn:ietf:params:xml:ns:caldav:calendar-data']) {
        return properties['urn:ietf:params:xml:ns:caldav:calendar-data'];
      }

      // Try to find any property containing calendar data
      for (const key in properties) {
        if (
          key.toLowerCase().includes('calendar-data') ||
          key.toLowerCase().includes('calendardata')
        ) {
          return properties[key];
        }
      }

      return null;
    } catch (error) {
      logger.warn('Error extracting calendar data', error);
      return null;
    }
  }
}
