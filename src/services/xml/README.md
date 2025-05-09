# XML Service

The XML Service provides a unified approach for handling XML operations in the application, with specific support for CalDAV-related XML generation and parsing.

## Core Components

### 1. XmlService

The base service for XML operations providing essential functionality:

```typescript
import { XmlService } from '../services/xml';

const xmlService = new XmlService();

// Escape XML content
const safeContent = xmlService.escapeXml('<unsafe & content>');

// Create an XML element
const element = xmlService.createXmlElement('displayname', 'Calendar Name');

// Parse XML
const parsed = await xmlService.parseXml(xmlString);

// Extract multistatus information
const multistatus = xmlService.getMultistatus(parsed);
const responses = xmlService.getResponses(multistatus);
```

### 2. XmlDocumentBuilder

Fluent API for building XML documents:

```typescript
import { XmlService } from '../services/xml';

const xmlService = new XmlService();

// Create a document with namespaces
const doc = xmlService.createDocument('d:propfind', {
  'd': 'DAV:',
  'c': 'urn:ietf:params:xml:ns:caldav'
});

// Build document structure
doc.startElement('d:prop')
   .addEmptyElement('d:resourcetype')
   .addEmptyElement('d:displayname')
   .startElement('c:calendar-data')
     .startElement('c:expand')
       .addAttribute('start', '20230101T000000Z')
       .addAttribute('end', '20231231T235959Z')
     .endElement()
   .endElement()
   .endElement();

// Convert to string with XML declaration
const xmlString = doc.toString(true);
```

### 3. CalDavXmlBuilder

Specialized builder for CalDAV XML operations:

```typescript
import { XmlService, CalDavXmlBuilder } from '../services/xml';

const xmlService = new XmlService();
const calDavBuilder = new CalDavXmlBuilder(xmlService);

// Build a PROPFIND request
const propfindXml = calDavBuilder.buildPropfindRequest();

// Create a calendar
const mkcalendarXml = calDavBuilder.buildMkcalendarRequest('New Calendar', '#FF0000');

// Update calendar properties
const propPatchXml = calDavBuilder.buildProppatchRequest({
  displayName: 'Updated Calendar',
  color: '#00FF00',
  category: 'Work',
  focusPriority: 8
});

// Query for events in a date range
const timeRange = {
  start: new Date('2023-01-01'),
  end: new Date('2023-12-31')
};
const queryXml = calDavBuilder.buildCalendarQueryReport(timeRange);

// Query for a specific event
const eventXml = calDavBuilder.buildEventByUidRequest('event-123-abc');

// Parse multistatus responses
const responses = calDavBuilder.parseMultistatus(xmlData);
```

## Key Features

1. **Type Safety**: Strong TypeScript typing for XML operations
2. **Fluent API**: Intuitive, chainable methods for XML document construction
3. **Consistent Escaping**: Centralized XML character escaping
4. **CalDAV Support**: Pre-built methods for common CalDAV operations
5. **Robust Parsing**: Intelligent extraction of data from CalDAV responses

## ADHD-Friendly Features

The XML service includes specialized support for ADHD-friendly calendar features:

1. **Focus Priority**: Support for the `calendar-focus-priority` property
2. **Visual Categories**: Support for the `calendar-category` property
3. **Clear Structure**: Fluent API reduces cognitive load by organizing XML operations logically

## Usage Guidelines

1. Use the CalDavXmlBuilder for all CalDAV-related XML operations when possible
2. For custom XML needs, use the XmlDocumentBuilder
3. Always run your XML through the service's methods to ensure proper escaping
4. Use the parseMultistatus method to handle CalDAV responses consistently