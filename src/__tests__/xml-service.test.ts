import { XmlService } from '../services/xml/xml-service.js';
import { XmlParsingError } from '../services/xml/types.js';

describe('XmlService', () => {
  let xmlService: XmlService;

  beforeEach(() => {
    xmlService = new XmlService();
  });

  describe('escapeXml', () => {
    it('should escape special XML characters', () => {
      const input = 'Test & "quotes" and <tags> with \'apostrophes\'';
      const expected =
        'Test &amp; &quot;quotes&quot; and &lt;tags&gt; with &apos;apostrophes&apos;';
      expect(xmlService.escapeXml(input)).toBe(expected);
    });

    it('should handle empty strings', () => {
      expect(xmlService.escapeXml('')).toBe('');
    });

    it('should handle null and undefined inputs', () => {
      expect(xmlService.escapeXml(null)).toBe('');
      expect(xmlService.escapeXml(undefined)).toBe('');
    });

    it('should handle strings with multiple special characters', () => {
      const input = '<script>alert("XSS & Injection")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS &amp; Injection&quot;)&lt;/script&gt;';
      expect(xmlService.escapeXml(input)).toBe(expected);
    });
  });

  describe('createXmlElement', () => {
    it('should create a well-formed XML element with escaped content', () => {
      const tagName = 'displayname';
      const content = 'Calendar & <Events>';
      const expected = '<displayname>Calendar &amp; &lt;Events&gt;</displayname>';
      expect(xmlService.createXmlElement(tagName, content)).toBe(expected);
    });

    it('should handle empty content', () => {
      expect(xmlService.createXmlElement('empty', '')).toBe('<empty></empty>');
    });

    it('should handle null and undefined content', () => {
      expect(xmlService.createXmlElement('null', null)).toBe('<null></null>');
      expect(xmlService.createXmlElement('undefined', undefined)).toBe('<undefined></undefined>');
    });

    it('should include attributes when provided', () => {
      const tagName = 'resource';
      const content = 'content';
      const attributes = { type: 'calendar', id: 'cal123' };
      const expected = '<resource type="calendar" id="cal123">content</resource>';
      expect(xmlService.createXmlElement(tagName, content, attributes)).toBe(expected);
    });

    it('should escape attribute values', () => {
      const tagName = 'element';
      const content = 'content';
      const attributes = { attr: 'value with "quotes" & <special> chars' };
      const expected =
        '<element attr="value with &quot;quotes&quot; &amp; &lt;special&gt; chars">content</element>';
      expect(xmlService.createXmlElement(tagName, content, attributes)).toBe(expected);
    });
  });

  describe('createEmptyElement', () => {
    it('should create a self-closing XML element', () => {
      const tagName = 'property';
      const expected = '<property />';
      expect(xmlService.createEmptyElement(tagName)).toBe(expected);
    });

    it('should include attributes when provided', () => {
      const tagName = 'property';
      const attributes = { name: 'resourcetype' };
      const expected = '<property name="resourcetype" />';
      expect(xmlService.createEmptyElement(tagName, attributes)).toBe(expected);
    });
  });

  describe('formatUTCDate', () => {
    it('should format a date as a CalDAV-compatible UTC string', () => {
      // Create a fixed date for testing
      const date = new Date('2023-04-15T10:30:45.123Z');
      const expected = '20230415T103045Z';
      expect(xmlService.formatUTCDate(date)).toBe(expected);
    });
  });

  describe('createXmlDocument', () => {
    it('should create an XML document with declaration', () => {
      const content = '<root><child>content</child></root>';
      const expected =
        '<?xml version="1.0" encoding="UTF-8"?>\n<root><child>content</child></root>';
      expect(xmlService.createXmlDocument(content)).toBe(expected);
    });

    it('should use custom version and encoding when provided', () => {
      const content = '<root><child>content</child></root>';
      const expected =
        '<?xml version="1.1" encoding="utf-16"?>\n<root><child>content</child></root>';
      expect(xmlService.createXmlDocument(content, '1.1', 'utf-16')).toBe(expected);
    });
  });

  describe('getMultistatus', () => {
    it('should extract multistatus element with d:multistatus key', () => {
      const xmlData = {
        'd:multistatus': {
          'd:response': [{ 'd:href': '/calendar/123' }],
        },
      };
      const result = xmlService.getMultistatus(xmlData);
      expect(result).toEqual(xmlData['d:multistatus']);
    });

    it('should extract multistatus element with multistatus key', () => {
      const xmlData = {
        multistatus: {
          response: [{ href: '/calendar/123' }],
        },
      };
      const result = xmlService.getMultistatus(xmlData);
      expect(result).toEqual(xmlData['multistatus']);
    });

    it('should handle case-insensitive key matching', () => {
      const xmlData = {
        multiStatus: {
          response: [{ href: '/calendar/123' }],
        },
      };
      const result = xmlService.getMultistatus(xmlData);
      expect(result).toEqual(xmlData['multiStatus']);
    });

    it('should return null when no multistatus element is found', () => {
      const xmlData = {
        other: {
          data: 'value',
        },
      };
      const result = xmlService.getMultistatus(xmlData);
      expect(result).toBeNull();
    });
  });

  describe('getResponses', () => {
    it('should extract responses from d:response array', () => {
      const multistatus = {
        'd:response': [{ 'd:href': '/calendar/1' }, { 'd:href': '/calendar/2' }],
      };
      const result = xmlService.getResponses(multistatus);
      expect(result).toEqual(multistatus['d:response']);
    });

    it('should extract responses from response array', () => {
      const multistatus = {
        response: [{ href: '/calendar/1' }, { href: '/calendar/2' }],
      };
      const result = xmlService.getResponses(multistatus);
      expect(result).toEqual(multistatus['response']);
    });

    it('should handle single response object', () => {
      const multistatus = {
        'd:response': { 'd:href': '/calendar/1' },
      };
      const result = xmlService.getResponses(multistatus);
      expect(result).toEqual([multistatus['d:response']]);
    });

    it('should return empty array when no responses are found', () => {
      const multistatus = {
        other: 'value',
      };
      const result = xmlService.getResponses(multistatus);
      expect(result).toEqual([]);
    });
  });

  describe('parseXml', () => {
    it('should parse valid XML successfully', async () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
        <d:multistatus xmlns:d="DAV:">
          <d:response>
            <d:href>/calendars/user/calendar1/</d:href>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:response>
        </d:multistatus>`;

      const result = await xmlService.parseXml(xmlString);
      expect(result).toHaveProperty('d:multistatus');
      expect(result['d:multistatus']).toHaveProperty('d:response');
    });

    it('should handle XML with alternate formatting', async () => {
      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
        <multistatus xmlns="DAV:">
          <response>
            <href>/calendars/user/calendar1/</href>
            <status>HTTP/1.1 200 OK</status>
          </response>
        </multistatus>`;

      const result = await xmlService.parseXml(xmlString);
      expect(result).toHaveProperty('multistatus');
    });

    it('should throw XmlParsingError when allowFallback is false and parsing fails', async () => {
      const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
        <unclosed>
          <tag>This XML is invalid
        </unclosed>`;

      await expect(
        xmlService.parseXml(invalidXml, { allowFallback: false }),
      ).rejects.toBeInstanceOf(XmlParsingError);
    });

    it('should include original XML and options in XmlParsingError', async () => {
      const invalidXml = `<?xml version="1.0" encoding="UTF-8"?>
        <unclosed>
          <tag>This XML is invalid
        </unclosed>`;

      // Using expect().rejects version
      await expect(xmlService.parseXml(invalidXml, { allowFallback: false })).rejects.toMatchObject(
        {
          name: 'XmlParsingError',
          xmlString: invalidXml,
        },
      );
    });

    it('should reject XXE attack attempts with security settings', async () => {
      // Our XML parser rejects malformed entity declarations with security settings
      // So we'll test that it rejects the XML rather than expanding it
      const xxeXml = `<?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE test [
          <!ENTITY xxe SYSTEM "file:///etc/passwd">
        ]>
        <test>&xxe;</test>`;

      // Should throw an error rather than process the entity
      await expect(xmlService.parseXml(xxeXml)).rejects.toBeInstanceOf(XmlParsingError);
    });

    it('should use direct formatting in formatUTCDate', () => {
      // Test with a fixed date
      const date = new Date(Date.UTC(2023, 5, 15, 10, 30, 45, 123));
      expect(xmlService.formatUTCDate(date)).toBe('20230615T103045Z');
    });
  });

  describe('dispose functionality', () => {
    it('should not throw when using dispose method on XmlDocumentBuilder', () => {
      const doc = xmlService.createDocument('root');
      expect(() => {
        doc.dispose();
      }).not.toThrow();
    });

    it('should throw when using a disposed XmlDocumentBuilder', () => {
      const doc = xmlService.createDocument('root');
      doc.dispose();
      expect(() => {
        doc.addElement('child');
      }).toThrow();
    });

    it('should allow disposal to be called multiple times', () => {
      const doc = xmlService.createDocument('root');
      doc.dispose();
      expect(() => {
        doc.dispose();
      }).not.toThrow();
    });
  });
});
