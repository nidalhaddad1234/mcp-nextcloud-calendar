import { XmlService } from '../services/xml/xml-service.js';
import { XmlDocumentBuilder } from '../services/xml/xml-document-builder.js';

describe('XmlDocumentBuilder', () => {
  let xmlService: XmlService;

  beforeEach(() => {
    xmlService = new XmlService();
  });

  describe('basic functionality', () => {
    it('should create a simple XML document', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      const result = builder.toString();
      expect(result).toBe('<root></root>');
    });

    it('should add namespaces to the root element', () => {
      const namespaces = {
        d: 'DAV:',
        cal: 'urn:ietf:params:xml:ns:caldav',
      };
      const builder = new XmlDocumentBuilder(xmlService, 'root', namespaces);
      const result = builder.toString();
      expect(result).toBe('<root xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav"></root>');
    });

    it('should handle default xmlns namespace', () => {
      const namespaces = {
        xmlns: 'default-namespace',
        d: 'DAV:',
      };
      const builder = new XmlDocumentBuilder(xmlService, 'root', namespaces);
      const result = builder.toString();
      expect(result).toBe('<root xmlns="default-namespace" xmlns:d="DAV:"></root>');
    });
  });

  describe('addElement', () => {
    it('should add a child element', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.addElement('child');
      const result = builder.toString();
      expect(result).toBe('<root><child></child></root>');
    });

    it('should add content to a child element', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.addElement('child', 'content');
      const result = builder.toString();
      expect(result).toBe('<root><child>content</child></root>');
    });

    it('should add multiple child elements', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.addElement('child1', 'content1');
      builder.addElement('child2', 'content2');
      const result = builder.toString();
      expect(result).toBe('<root><child1>content1</child1><child2>content2</child2></root>');
    });

    it('should escape special characters in content', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.addElement('child', '<content & "quotes">');
      const result = builder.toString();
      expect(result).toBe('<root><child>&lt;content &amp; &quot;quotes&quot;&gt;</child></root>');
    });
  });

  describe('addAttribute', () => {
    it('should add an attribute to the current element', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.addAttribute('attr', 'value');
      const result = builder.toString();
      expect(result).toBe('<root attr="value"></root>');
    });

    it('should escape special characters in attribute values', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.addAttribute('attr', 'value & <special>');
      const result = builder.toString();
      expect(result).toBe('<root attr="value &amp; &lt;special&gt;"></root>');
    });
  });

  describe('startElement and endElement', () => {
    it('should create nested elements', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.startElement('parent').startElement('child').endElement().endElement();
      const result = builder.toString();
      expect(result).toBe('<root><parent><child></child></parent></root>');
    });

    it('should maintain the current element context', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder
        .startElement('parent')
        .addElement('child1')
        .startElement('child2')
        .addElement('grandchild')
        .endElement()
        .addElement('child3')
        .endElement();
      const result = builder.toString();
      expect(result).toBe(
        '<root><parent><child1></child1><child2><grandchild></grandchild></child2><child3></child3></parent></root>',
      );
    });

    it('should ignore endElement when at the root', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.endElement(); // Should have no effect
      const result = builder.toString();
      expect(result).toBe('<root></root>');
    });

    it('should allow adding attributes to nested elements', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder
        .startElement('parent')
        .addAttribute('attr1', 'value1')
        .startElement('child')
        .addAttribute('attr2', 'value2')
        .endElement()
        .endElement();
      const result = builder.toString();
      expect(result).toBe(
        '<root><parent attr1="value1"><child attr2="value2"></child></parent></root>',
      );
    });
  });

  describe('addEmptyElement', () => {
    it('should create a self-closing element', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.addEmptyElement('empty');
      const result = builder.toString();
      expect(result).toBe('<root><empty /></root>');
    });

    it('should work with nested elements', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.startElement('parent').addEmptyElement('empty').endElement();
      const result = builder.toString();
      expect(result).toBe('<root><parent><empty /></parent></root>');
    });
  });

  describe('toString', () => {
    it('should return XML without declaration by default', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.addElement('child');
      const result = builder.toString();
      expect(result).toBe('<root><child></child></root>');
    });

    it('should include XML declaration when requested', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.addElement('child');
      const result = builder.toString(true);
      expect(result).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<root><child></child></root>');
    });

    it('should use custom version and encoding when provided', () => {
      const builder = new XmlDocumentBuilder(xmlService, 'root');
      builder.addElement('child');
      const result = builder.toString(true, '1.1', 'UTF-16');
      expect(result).toBe('<?xml version="1.1" encoding="UTF-16"?>\n<root><child></child></root>');
    });
  });

  describe('complex document building', () => {
    it('should create a complex document with mixed API usage', () => {
      const namespaces = {
        d: 'DAV:',
        c: 'urn:ietf:params:xml:ns:caldav',
      };

      const builder = new XmlDocumentBuilder(xmlService, 'd:propfind', namespaces);

      builder
        .startElement('d:prop')
        .addEmptyElement('d:resourcetype')
        .addEmptyElement('d:displayname')
        .startElement('c:calendar-data')
        .startElement('c:expand')
        .addAttribute('start', '20230101T000000Z')
        .addAttribute('end', '20231231T235959Z')
        .endElement() // End c:expand
        .endElement() // End c:calendar-data
        .endElement(); // End d:prop

      const result = builder.toString(true);

      const expected =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
        '<d:prop>' +
        '<d:resourcetype />' +
        '<d:displayname />' +
        '<c:calendar-data>' +
        '<c:expand start="20230101T000000Z" end="20231231T235959Z"></c:expand>' +
        '</c:calendar-data>' +
        '</d:prop>' +
        '</d:propfind>';

      expect(result).toBe(expected);
    });
  });
});
