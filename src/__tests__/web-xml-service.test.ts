/**
 * Tests for web-based XML service implementation
 */
import { WebXmlService } from '../services/xml/web-xml-service.js';
import { WebXmlDocumentBuilder } from '../services/xml/web-xml-document-builder.js';
import { WebCalDavXmlBuilder } from '../services/xml/web-caldav-xml-builder.js';
import { XmlSecurity } from '../services/xml/xml-security.js';
import { XmlParsingError } from '../services/xml/types.js';

// Import jest functions
import { jest, describe, expect, test, beforeEach, afterEach } from '@jest/globals';

// Mock fast-xml-parser
jest.mock('fast-xml-parser', () => ({
  XMLParser: jest.fn().mockImplementation(() => ({
    parse: jest.fn().mockReturnValue({ root: { item: 'value' } })
  })),
  XMLBuilder: jest.fn().mockImplementation(() => ({
    build: jest.fn().mockReturnValue('<xml></xml>')
  })),
  XMLValidator: {
    validate: jest.fn().mockReturnValue(true)
  }
}));

describe('WebXmlService', () => {
  let xmlService: WebXmlService;
  
  beforeEach(() => {
    xmlService = new WebXmlService();
  });

  describe('Basic XML Operations', () => {
    test('escapeXml escapes special characters', () => {
      const input = 'Text with <tags> & "quotes" and \'apostrophes\'';
      const expected = 'Text with &lt;tags&gt; &amp; &quot;quotes&quot; and &apos;apostrophes&apos;';
      expect(xmlService.escapeXml(input)).toBe(expected);
    });

    test('escapeXml handles null and undefined', () => {
      expect(xmlService.escapeXml(null)).toBe('');
      expect(xmlService.escapeXml(undefined)).toBe('');
    });

    test('createXmlElement creates a properly formatted XML element', () => {
      const result = xmlService.createXmlElement('item', 'content');
      expect(result).toBe('<item>content</item>');
    });

    test('createXmlElement with attributes', () => {
      const result = xmlService.createXmlElement('item', 'content', { id: '123', class: 'test' });
      expect(result).toBe('<item id="123" class="test">content</item>');
    });

    test('createEmptyElement creates a self-closing tag', () => {
      const result = xmlService.createEmptyElement('item');
      expect(result).toBe('<item />');
    });

    test('createEmptyElement with attributes', () => {
      const result = xmlService.createEmptyElement('item', { id: '123', class: 'test' });
      expect(result).toBe('<item id="123" class="test" />');
    });

    test('formatUTCDate produces correctly formatted string', () => {
      const date = new Date('2023-05-15T08:30:45Z');
      const result = xmlService.formatUTCDate(date);
      expect(result).toBe('20230515T083045Z');
    });

    test('createXmlDocument adds XML declaration', () => {
      const content = '<root><item>value</item></root>';
      const result = xmlService.createXmlDocument(content);
      expect(result).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<root><item>value</item></root>');
    });
  });

  describe('XML Parsing', () => {
    test('parseXml correctly parses simple XML', async () => {
      const xml = '<root><item>value</item></root>';
      const result = await xmlService.parseXml(xml);
      expect(result).toHaveProperty('root');
      const root = result.root as Record<string, unknown>;
      expect(root).toHaveProperty('item');
      expect(root.item).toBe('value');
    });

    test('parseXml handles attributes', async () => {
      const xml = '<root><item id="123">value</item></root>';
      const result = await xmlService.parseXml(xml);
      const root = result.root as Record<string, unknown>;
      const item = root.item as Record<string, unknown>;
      expect(item).toHaveProperty('$');
      const attrs = item.$ as Record<string, string>;
      expect(attrs).toHaveProperty('id');
      expect(attrs.id).toBe('123');
    });

    test('parseXml handles CDATA sections', async () => {
      const xml = '<root><item><![CDATA[<strong>HTML</strong> content]]></item></root>';
      const result = await xmlService.parseXml(xml);
      const root = result.root as Record<string, unknown>;
      const item = root.item as Record<string, unknown>;
      expect(item).toHaveProperty('#cdata');
      expect(item['#cdata']).toBe('<strong>HTML</strong> content');
    });

    test('parseXml throws XmlParsingError for invalid XML', async () => {
      const xml = '<root><item>value</item';
      await expect(xmlService.parseXml(xml, { allowFallback: false })).rejects.toThrow(XmlParsingError);
    });

    test('parseXml handles arrays of elements', async () => {
      const xml = '<root><item>value1</item><item>value2</item></root>';
      const result = await xmlService.parseXml(xml);
      const root = result.root as Record<string, unknown>;
      const items = root.item as unknown[];
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(2);
      expect(items[0]).toBe('value1');
      expect(items[1]).toBe('value2');
    });
  });

  describe('CalDAV XML Helpers', () => {
    test('getMultistatus extracts multistatus element', async () => {
      const xml = `
        <d:multistatus xmlns:d="DAV:">
          <d:response>
            <d:href>/calendars/test/</d:href>
          </d:response>
        </d:multistatus>
      `;
      const parsed = await xmlService.parseXml(xml);
      const multistatus = xmlService.getMultistatus(parsed);
      expect(multistatus).toBeTruthy();
      expect(multistatus).toHaveProperty('d:response');
    });

    test('getMultistatus handles different namespaces', async () => {
      const xml = `
        <multistatus xmlns="DAV:">
          <response>
            <href>/calendars/test/</href>
          </response>
        </multistatus>
      `;
      const parsed = await xmlService.parseXml(xml);
      const multistatus = xmlService.getMultistatus(parsed);
      expect(multistatus).toBeTruthy();
      expect(multistatus).toHaveProperty('response');
    });

    test('getResponses extracts array of responses', async () => {
      const xml = `
        <d:multistatus xmlns:d="DAV:">
          <d:response>
            <d:href>/calendars/test1/</d:href>
          </d:response>
          <d:response>
            <d:href>/calendars/test2/</d:href>
          </d:response>
        </d:multistatus>
      `;
      const parsed = await xmlService.parseXml(xml);
      const multistatus = xmlService.getMultistatus(parsed);
      expect(multistatus).toBeTruthy();
      
      const responses = xmlService.getResponses(multistatus!);
      expect(responses).toHaveLength(2);
      expect(responses[0]).toHaveProperty('d:href');
      expect(responses[1]).toHaveProperty('d:href');
    });
  });
  
  describe('Security Features', () => {
    test('it prevents XXE attacks', async () => {
      const maliciousXml = `
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE foo [
          <!ENTITY xxe SYSTEM "file:///etc/passwd">
        ]>
        <root>&xxe;</root>
      `;
      
      const validation = XmlSecurity.validateXml(maliciousXml);
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      
      // Should still be able to parse but safely
      const result = await xmlService.parseXml(maliciousXml);
      expect(result).toHaveProperty('root');
      // The entity should not be expanded
      const root = result.root as string | Record<string, unknown>;
      expect(typeof root === 'string' ? root : JSON.stringify(root)).not.toContain('root:');
    });
    
    test('it detects billion laughs attacks', async () => {
      const billionLaughs = `
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE lolz [
          <!ENTITY lol "lol">
          <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
          <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
          <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
        ]>
        <lolz>&lol3;</lolz>
      `;
      
      const detection = XmlSecurity.detectEntityExpansionAttack(billionLaughs);
      expect(detection.detected).toBe(true);
      
      // This should be caught by validation
      const validation = XmlSecurity.validateXml(billionLaughs);
      expect(validation.valid).toBe(false);
    });
  });
});

describe('WebXmlDocumentBuilder', () => {
  let xmlService: WebXmlService;
  let builder: WebXmlDocumentBuilder;
  
  beforeEach(() => {
    xmlService = new WebXmlService();
    builder = xmlService.createDocument('root');
  });
  
  afterEach(() => {
    builder.dispose();
  });
  
  test('basic XML creation', () => {
    builder.addElement('item', 'test');
    const result = builder.toString();
    expect(result).toBe('<root><item>test</item></root>');
  });
  
  test('nested elements', () => {
    builder
      .startElement('parent')
      .addElement('child1', 'value1')
      .addElement('child2', 'value2')
      .endElement();
    
    const result = builder.toString();
    expect(result).toBe('<root><parent><child1>value1</child1><child2>value2</child2></parent></root>');
  });
  
  test('attributes', () => {
    builder
      .startElement('item')
      .addAttribute('id', '123')
      .addAttribute('type', 'test')
      .setContent('content');
    
    const result = builder.toString();
    expect(result).toBe('<root><item id="123" type="test">content</item></root>');
  });
  
  test('empty elements', () => {
    builder.addEmptyElement('empty');
    const result = builder.toString();
    expect(result).toBe('<root><empty /></root>');
  });
  
  test('XML declaration', () => {
    builder.addElement('item', 'test');
    const result = builder.toString(true);
    expect(result).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<root><item>test</item></root>');
  });
  
  test('namespaces', () => {
    const nsBuilder = xmlService.createDocument('d:root', {
      d: 'DAV:',
      c: 'urn:ietf:params:xml:ns:caldav'
    });
    
    nsBuilder.addElement('d:item', 'test');
    const result = nsBuilder.toString();
    expect(result).toContain('xmlns:d="DAV:"');
    expect(result).toContain('xmlns:c="urn:ietf:params:xml:ns:caldav"');
    expect(result).toContain('<d:item>test</d:item>');
    
    nsBuilder.dispose();
  });
  
  test('object conversion', () => {
    builder
      .startElement('parent')
      .addAttribute('id', '123')
      .addElement('child', 'value')
      .endElement();
    
    const obj = builder.toObject();
    expect(obj).toHaveProperty('root');
    const root = obj.root as Record<string, unknown>;
    expect(root).toHaveProperty('parent');
    const parent = root.parent as Record<string, unknown>;
    expect(parent).toHaveProperty('$');
    const attrs = parent.$ as Record<string, string>;
    expect(attrs).toHaveProperty('id', '123');
    expect(parent).toHaveProperty('child', 'value');
  });
  
  test('error after dispose', () => {
    builder.dispose();
    expect(() => {
      builder.addElement('item', 'test');
    }).toThrow();
  });
});

describe('WebCalDavXmlBuilder', () => {
  let xmlService: WebXmlService;
  let caldavBuilder: WebCalDavXmlBuilder;
  
  beforeEach(() => {
    xmlService = new WebXmlService();
    caldavBuilder = new WebCalDavXmlBuilder(xmlService);
  });
  
  test('buildPropfindRequest creates valid XML', () => {
    const result = caldavBuilder.buildPropfindRequest();
    
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"');
    expect(result).toContain('<d:prop>');
    expect(result).toContain('<d:resourcetype />');
    expect(result).toContain('<d:displayname />');
  });
  
  test('buildMkcalendarRequest creates valid XML', () => {
    const result = caldavBuilder.buildMkcalendarRequest('Test Calendar', '#ff0000');
    
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"');
    expect(result).toContain('<c:displayname>Test Calendar</c:displayname>');
    expect(result).toContain('<x1:calendar-color>#ff0000</x1:calendar-color>');
  });
  
  test('buildProppatchRequest creates valid XML', () => {
    const result = caldavBuilder.buildProppatchRequest({
      displayName: 'Updated Calendar',
      color: '#00ff00',
      category: 'Important',
      focusPriority: 5
    });
    
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<d:propertyupdate xmlns:d="DAV:"');
    expect(result).toContain('<d:displayname>Updated Calendar</d:displayname>');
    expect(result).toContain('<x1:calendar-color>#00ff00</x1:calendar-color>');
    expect(result).toContain('<x2:calendar-category>Important</x2:calendar-category>');
    expect(result).toContain('<x2:calendar-focus-priority>5</x2:calendar-focus-priority>');
  });
  
  test('buildCalendarQueryReport creates valid XML', () => {
    const start = new Date('2023-01-01T00:00:00Z');
    const end = new Date('2023-12-31T23:59:59Z');
    
    const result = caldavBuilder.buildCalendarQueryReport({ start, end });
    
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"');
    expect(result).toContain('<d:prop>');
    expect(result).toContain('<c:time-range start="20230101T000000Z" end="20231231T235959Z" />');
  });
  
  test('buildEventByUidRequest creates valid XML', () => {
    const result = caldavBuilder.buildEventByUidRequest('event-123-456');
    
    expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result).toContain('<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"');
    expect(result).toContain('<c:prop-filter name="UID">');
    expect(result).toContain('<c:text-match collation="i;unicode-casemap">event-123-456</c:text-match>');
  });
  
  test('parseMultistatus processes responses', async () => {
    // Create a sample multistatus response
    const multistatus = `
      <?xml version="1.0" encoding="UTF-8"?>
      <d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
        <d:response>
          <d:href>/calendars/user/calendar1/</d:href>
          <d:propstat>
            <d:prop>
              <d:displayname>Personal</d:displayname>
              <cal:calendar-color>#ff9900</cal:calendar-color>
            </d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:propstat>
        </d:response>
        <d:response>
          <d:href>/calendars/user/calendar2/</d:href>
          <d:propstat>
            <d:prop>
              <d:displayname>Work</d:displayname>
              <cal:calendar-color>#0099ff</cal:calendar-color>
            </d:prop>
            <d:status>HTTP/1.1 200 OK</d:status>
          </d:propstat>
        </d:response>
      </d:multistatus>
    `;
    
    // Parse the XML
    const parsed = await xmlService.parseXml(multistatus);
    
    // Process with WebCalDavXmlBuilder
    const responses = caldavBuilder.parseMultistatus(parsed);
    
    // Assertions
    expect(responses).toHaveLength(2);
    
    expect(responses[0].href).toContain('/calendars/user/calendar1/');
    expect(responses[0].properties).toBeDefined();
    expect(responses[0].properties['d:displayname']).toBe('Personal');
    
    expect(responses[1].href).toContain('/calendars/user/calendar2/');
    expect(responses[1].properties).toBeDefined();
    expect(responses[1].properties['d:displayname']).toBe('Work');
  });
});

describe('XmlSecurity', () => {
  test('validateXml detects oversized documents', () => {
    // Create a string larger than the default limit (just for testing, set a small limit)
    const largeXml = '<root>' + 'x'.repeat(1000) + '</root>';
    
    const result = XmlSecurity.validateXml(largeXml, { maxSize: 500 });
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.includes('exceeds maximum size'))).toBe(true);
  });
  
  test('validateXml detects external DTDs', () => {
    const externalDtd = `
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE root SYSTEM "http://evil.com/evil.dtd">
      <root>test</root>
    `;
    
    const result = XmlSecurity.validateXml(externalDtd);
    expect(result.valid).toBe(false);
    expect(result.issues.some(issue => issue.includes('External DTDs are not allowed'))).toBe(true);
  });
  
  test('detectXxeAttempt identifies XXE attack patterns', () => {
    const xxeXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE foo [
        <!ENTITY xxe SYSTEM "file:///etc/passwd">
      ]>
      <root>&xxe;</root>
    `;
    
    const result = XmlSecurity.detectXxeAttempt(xxeXml);
    expect(result.detected).toBe(true);
  });
  
  test('sanitizeXml removes dangerous content', () => {
    const maliciousXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE foo [
        <!ENTITY xxe SYSTEM "file:///etc/passwd">
      ]>
      <?xml-stylesheet type="text/xsl" href="style.xsl"?>
      <root>&xxe;</root>
    `;
    
    const sanitized = XmlSecurity.sanitizeXml(maliciousXml);
    expect(sanitized).not.toContain('<!DOCTYPE');
    expect(sanitized).not.toContain('<!ENTITY');
    expect(sanitized).not.toContain('<?xml-stylesheet');
  });
  
  test('createSafeParserOptions generates secure options', () => {
    const options = XmlSecurity.createSafeParserOptions();
    
    expect(options).toHaveProperty('processEntities', false);
    expect(options).toHaveProperty('allowBooleanAttributes', true);
    expect(options).toHaveProperty('attributeNamePrefix');
    expect(options).toHaveProperty('attributesGroupName');
  });
});