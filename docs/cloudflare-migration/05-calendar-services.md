# Calendar Services Migration

This document covers migrating the Calendar and Event services from Express.js to Cloudflare Workers.

## HTTP Client Adaptation

The first step is to replace Axios with the Fetch API for HTTP requests:

### Current Implementation (using Axios)

```typescript
import axios from 'axios';

export class HttpClient {
  private baseUrl: string;
  private authHeader: string;
  
  constructor(config: NextcloudConfig) {
    this.baseUrl = config.baseUrl;
    this.authHeader = 'Basic ' + Buffer.from(`${config.username}:${config.appToken}`).toString('base64');
  }
  
  async propfind(url: string, depth: number, data: string): Promise<any> {
    try {
      const response = await axios({
        method: 'PROPFIND',
        url,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Depth': depth.toString(),
          'Authorization': this.authHeader
        },
        data
      });
      
      return response;
    } catch (error) {
      // Handle error
      throw error;
    }
  }
  
  // Other HTTP methods...
}
```

### Workers Implementation (using Fetch API)

```typescript
export class HttpClient {
  private baseUrl: string;
  private authHeader: string;
  
  constructor(config: NextcloudConfig) {
    this.baseUrl = config.baseUrl;
    this.authHeader = 'Basic ' + btoa(`${config.username}:${config.appToken}`);
  }
  
  async propfind(url: string, depth: number, data: string): Promise<Response> {
    try {
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Depth': depth.toString(),
          'Authorization': this.authHeader
        },
        body: data
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      // Handle error
      throw error;
    }
  }
  
  async get(url: string): Promise<Response> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      // Handle error
      throw error;
    }
  }
  
  async put(url: string, data: string, contentType: string = 'application/xml'): Promise<Response> {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'Authorization': this.authHeader
        },
        body: data
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      // Handle error
      throw error;
    }
  }
  
  async delete(url: string): Promise<Response> {
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': this.authHeader
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      // Handle error
      throw error;
    }
  }
  
  // Helper method to convert Response to axios-like format
  async processResponse(response: Response): Promise<any> {
    const data = await response.text();
    
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers)
    };
  }
}
```

## Calendar Service Adaptation

The Calendar Service adapts the HTTP client while maintaining the same interface:

```typescript
export class CalendarService {
  private httpClient: HttpClient;
  private xmlService: WebXmlService;
  private calDavBuilder: WebCalDavXmlBuilder;
  private username: string;
  
  constructor(config: NextcloudConfig) {
    this.httpClient = new HttpClient(config);
    this.xmlService = new WebXmlService();
    this.calDavBuilder = new WebCalDavXmlBuilder(this.xmlService);
    this.username = config.username;
  }
  
  async getCalendars(): Promise<Calendar[]> {
    try {
      const url = `${this.baseUrl}/remote.php/dav/calendars/${this.username}/`;
      const xmlRequest = this.calDavBuilder.buildPropfindRequest();
      
      const response = await this.httpClient.propfind(url, 1, xmlRequest);
      const axiosResponse = await this.httpClient.processResponse(response);
      const xmlData = axiosResponse.data;
      
      const parsedData = await this.xmlService.parseXml(xmlData);
      const multistatus = this.xmlService.getMultistatus(parsedData);
      
      if (!multistatus) {
        return [];
      }
      
      const responses = this.xmlService.getResponses(multistatus);
      return this.processCalendarResponses(responses);
    } catch (error) {
      console.error('Error fetching calendars:', error);
      throw error;
    }
  }
  
  // Process the calendar responses to extract calendar information
  private processCalendarResponses(responses: Array<Record<string, unknown>>): Calendar[] {
    const calendars: Calendar[] = [];
    
    for (const response of responses) {
      try {
        const href = this.extractHref(response);
        if (!href || href === `/remote.php/dav/calendars/${this.username}/`) {
          // Skip the principal collection
          continue;
        }
        
        // Process properties
        const propstat = this.findSuccessfulPropstat(response);
        if (!propstat || !propstat['d:prop']) {
          continue;
        }
        
        const props = propstat['d:prop'] as Record<string, unknown>;
        
        // Extract resourcetype to verify this is a calendar
        const resourceType = props['d:resourcetype'] as Record<string, unknown>;
        if (!resourceType || !resourceType['cal:calendar']) {
          continue;
        }
        
        // Extract calendar properties
        const calendar = this.createCalendarFromProps(href, props);
        if (calendar) {
          calendars.push(calendar);
        }
      } catch (error) {
        console.error('Error processing calendar response:', error);
        // Continue with next response
      }
    }
    
    return calendars;
  }
  
  // Helper methods for processing properties...
}
```

## Event Service Adaptation

The Event Service follows a similar pattern:

```typescript
export class EventService {
  private httpClient: HttpClient;
  private xmlService: WebXmlService;
  private calDavBuilder: WebCalDavXmlBuilder;
  private username: string;
  
  constructor(config: NextcloudConfig) {
    this.httpClient = new HttpClient(config);
    this.xmlService = new WebXmlService();
    this.calDavBuilder = new WebCalDavXmlBuilder(this.xmlService);
    this.username = config.username;
  }
  
  async getEvents(calendarId: string, options: EventFilterOptions = {}): Promise<Event[]> {
    try {
      const url = `${this.baseUrl}/remote.php/dav/calendars/${this.username}/${calendarId}`;
      
      // Build CalDAV XML request with time range if specified
      const xmlRequest = this.calDavBuilder.buildCalendarQueryReport(
        options.start && options.end ? { start: options.start, end: options.end } : undefined,
        options.expandRecurring ? { expand: { start: options.start, end: options.end } } : undefined
      );
      
      const response = await this.httpClient.report(url, 1, xmlRequest);
      const axiosResponse = await this.httpClient.processResponse(response);
      const xmlData = axiosResponse.data;
      
      const parsedData = await this.xmlService.parseXml(xmlData);
      const multistatus = this.xmlService.getMultistatus(parsedData);
      
      if (!multistatus) {
        return [];
      }
      
      const responses = this.xmlService.getResponses(multistatus);
      let events = this.processEventResponses(responses, calendarId);
      
      // Apply additional filtering
      if (options.priorityMinimum) {
        events = events.filter(e => (e.focusPriority || 0) >= options.priorityMinimum);
      }
      
      if (options.adhdCategory) {
        events = events.filter(e => e.adhdCategory === options.adhdCategory);
      }
      
      if (options.tags && options.tags.length > 0) {
        events = events.filter(e => {
          if (!e.categories) return false;
          return options.tags.some(tag => e.categories.includes(tag));
        });
      }
      
      // Sort by start date
      events.sort((a, b) => a.start.getTime() - b.start.getTime());
      
      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        events = events.slice(0, options.limit);
      }
      
      return events;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }
  
  // Other methods for event operations...
}
```

## Handling Dates in Workers

Be careful with date handling in Workers, as it might behave differently than in Node.js:

```typescript
// Helper function for consistent date parsing
function parseISODate(dateString: string): Date {
  try {
    // Ensure proper ISO format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateString}`);
    }
    return date;
  } catch (error) {
    console.error(`Failed to parse date: ${dateString}`, error);
    throw new Error(`Invalid date format: ${dateString}`);
  }
}

// Helper function for consistent date formatting
function formatISODate(date: Date): string {
  try {
    return date.toISOString();
  } catch (error) {
    console.error(`Failed to format date`, error);
    throw new Error(`Invalid date object`);
  }
}
```

## Calendar Caching with Durable Objects

Implement caching for calendars to improve performance:

```typescript
export class CalendarCache implements DurableObject {
  private state: DurableObjectState;
  private cache: Map<string, { data: Calendar[]; timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  constructor(state: DurableObjectState) {
    this.state = state;
    this.cache = new Map();
    
    // Initialize cache from persistent storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, { data: Calendar[]; timestamp: number }>>('cache');
      if (stored) {
        this.cache = new Map(stored);
        
        // Clean expired entries
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
          if (now - entry.timestamp > this.CACHE_TTL) {
            this.cache.delete(key);
          }
        }
      }
    });
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const userId = url.searchParams.get('userId') || 'default';
    
    // Handle calendar cache operations
    if (path === '/calendars') {
      if (request.method === 'GET') {
        return this.handleGetCalendars(userId);
      } else if (request.method === 'PUT') {
        return this.handleSetCalendars(userId, request);
      } else if (request.method === 'DELETE') {
        return this.handleClearCache(userId);
      }
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  private async handleGetCalendars(userId: string): Promise<Response> {
    const cacheKey = `calendars:${userId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Cache miss' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS'
      }
    });
  }
  
  private async handleSetCalendars(userId: string, request: Request): Promise<Response> {
    try {
      const calendars = await request.json() as Calendar[];
      const cacheKey = `calendars:${userId}`;
      
      this.cache.set(cacheKey, {
        data: calendars,
        timestamp: Date.now()
      });
      
      // Persist to storage
      await this.state.storage.put('cache', this.cache);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to cache calendars' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleClearCache(userId: string): Promise<Response> {
    const cacheKey = `calendars:${userId}`;
    this.cache.delete(cacheKey);
    
    // Persist to storage
    await this.state.storage.put('cache', this.cache);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## Enhancing Calendar Service with Caching

Integrate the cache with the Calendar Service:

```typescript
export class EnhancedCalendarService {
  private httpClient: HttpClient;
  private xmlService: WebXmlService;
  private calDavBuilder: WebCalDavXmlBuilder;
  private username: string;
  private calendarCache: DurableObjectNamespace;
  private userId: string;
  
  constructor(config: NextcloudConfig, env: Env, userId: string = 'default') {
    this.httpClient = new HttpClient(config);
    this.xmlService = new WebXmlService();
    this.calDavBuilder = new WebCalDavXmlBuilder(this.xmlService);
    this.username = config.username;
    this.calendarCache = env.CALENDAR_CACHE;
    this.userId = userId;
  }
  
  async getCalendars(useCache = true): Promise<Calendar[]> {
    // Try to get from cache first if caching is enabled
    if (useCache) {
      try {
        const cacheId = this.calendarCache.idFromName(this.userId);
        const cacheObj = this.calendarCache.get(cacheId);
        
        const cacheResponse = await cacheObj.fetch(`/calendars?userId=${this.userId}`);
        
        if (cacheResponse.ok) {
          return await cacheResponse.json();
        }
      } catch (error) {
        // Cache miss or error, proceed with actual fetch
        console.log('Cache miss, fetching from Nextcloud');
      }
    }
    
    // Fetch from Nextcloud
    try {
      // Existing calendar fetch logic...
      const url = `${this.baseUrl}/remote.php/dav/calendars/${this.username}/`;
      const xmlRequest = this.calDavBuilder.buildPropfindRequest();
      
      const response = await this.httpClient.propfind(url, 1, xmlRequest);
      const axiosResponse = await this.httpClient.processResponse(response);
      const xmlData = axiosResponse.data;
      
      const parsedData = await this.xmlService.parseXml(xmlData);
      const multistatus = this.xmlService.getMultistatus(parsedData);
      
      if (!multistatus) {
        return [];
      }
      
      const responses = this.xmlService.getResponses(multistatus);
      const calendars = this.processCalendarResponses(responses);
      
      // Update cache if fetch was successful
      if (useCache && calendars.length > 0) {
        try {
          const cacheId = this.calendarCache.idFromName(this.userId);
          const cacheObj = this.calendarCache.get(cacheId);
          
          await cacheObj.fetch(`/calendars?userId=${this.userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(calendars)
          });
        } catch (error) {
          console.error('Failed to update cache:', error);
        }
      }
      
      return calendars;
    } catch (error) {
      console.error('Error fetching calendars:', error);
      throw error;
    }
  }
  
  // Other methods...
}
```

## Testing Calendar Service in Workers

```typescript
import { unstable_dev } from 'wrangler';
import { describe, test, expect, afterAll, beforeAll } from 'vitest';

describe('Calendar Service', () => {
  let worker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });

  afterAll(async () => {
    if (worker) {
      await worker.stop();
    }
  });

  test('listCalendars should return calendars', async () => {
    const resp = await worker.fetch('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'tool_call',
        tool_name: 'listCalendars',
        tool_args: {}
      })
    });

    expect(resp.status).toBe(200);
    const result = await resp.json();
    expect(result).toHaveProperty('content');
    
    // Parse the JSON from the content
    const content = JSON.parse(result.content[0].text);
    expect(content).toHaveProperty('success', true);
    expect(content).toHaveProperty('calendars');
    expect(Array.isArray(content.calendars)).toBe(true);
  });
});
```

## Next Steps

Once you have migrated your calendar services, proceed to set up state management with Durable Objects as described in [State Management](./06-state-management.md).