# State Management with Durable Objects

This document covers implementing persistent state management for the Cloudflare Workers migration using Durable Objects.

## Introduction to Durable Objects

Durable Objects provide a consistent, global coordination point with strongly consistent storage. They are ideal for:

1. Session management
2. Calendar data caching
3. User preferences
4. Event data synchronization

## Setting Up Durable Objects

### Wrangler Configuration

Configure Durable Objects in your `wrangler.toml`:

```toml
[durable_objects]
bindings = [
  { name = "SESSIONS", class_name = "SessionStore" },
  { name = "CALENDARS", class_name = "CalendarCache" }
]

[[migrations]]
tag = "v1"
new_classes = ["SessionStore", "CalendarCache"]
```

### Durable Object Types

Define the types for Durable Objects:

```typescript
// src/types/durable-objects.ts
export interface DurableObjectState {
  storage: DurableObjectStorage;
  blockConcurrencyWhile<T>(callback: () => Promise<T> | T): Promise<T>;
}

export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  put<T>(key: string, value: T): Promise<void>;
  put<T>(entries: Record<string, T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  list<T = unknown>(options?: DurableObjectStorageListOptions): Promise<Map<string, T>>;
  deleteAll(): Promise<void>;
}

export interface DurableObjectStorageListOptions {
  start?: string;
  end?: string;
  prefix?: string;
  reverse?: boolean;
  limit?: number;
}

export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  get(id: DurableObjectId): DurableObject;
}

export interface DurableObjectId {
  toString(): string;
}

export interface DurableObject {
  fetch(request: Request): Promise<Response>;
}
```

## Session Management

Create a Durable Object for session management:

```typescript
// src/durable-objects/session-store.ts
import { nanoid } from 'nanoid';

export interface SessionData {
  id: string;
  createdAt: number;
  updatedAt: number;
  userId?: string;
  data: Record<string, unknown>;
}

export class SessionStore implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<string, SessionData>;
  
  // Session expiry time: 1 hour
  private readonly SESSION_TTL = 60 * 60 * 1000;
  
  constructor(state: DurableObjectState) {
    this.state = state;
    this.sessions = new Map();
    
    // Initialize from storage
    this.state.blockConcurrencyWhile(async () => {
      // Load existing sessions
      const storedSessions = await this.state.storage.get<Map<string, SessionData>>('sessions');
      if (storedSessions) {
        this.sessions = storedSessions;
        
        // Clean expired sessions
        this.cleanExpiredSessions();
      }
    });
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Route based on path and method
    switch(true) {
      case path === '/create' && request.method === 'POST':
        return this.handleCreateSession(request);
      
      case path === '/get' && request.method === 'GET':
        return this.handleGetSession(request);
      
      case path === '/update' && request.method === 'POST':
        return this.handleUpdateSession(request);
      
      case path === '/delete' && request.method === 'DELETE':
        return this.handleDeleteSession(request);
      
      default:
        return new Response('Not found', { status: 404 });
    }
  }
  
  private async handleCreateSession(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { userId?: string; data?: Record<string, unknown> };
      
      const sessionId = nanoid();
      const now = Date.now();
      
      const session: SessionData = {
        id: sessionId,
        createdAt: now,
        updatedAt: now,
        userId: body.userId,
        data: body.data || {}
      };
      
      this.sessions.set(sessionId, session);
      await this.state.storage.put('sessions', this.sessions);
      
      return new Response(JSON.stringify({ sessionId, session }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  private handleGetSession(request: Request): Response {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('id');
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Touch the session to update last access time
    session.updatedAt = Date.now();
    this.sessions.set(sessionId, session);
    this.state.storage.put('sessions', this.sessions);
    
    return new Response(JSON.stringify({ session }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private async handleUpdateSession(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { sessionId: string; data: Record<string, unknown> };
      const { sessionId, data } = body;
      
      if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Session ID required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const session = this.sessions.get(sessionId);
      if (!session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Update session data
      session.data = { ...session.data, ...data };
      session.updatedAt = Date.now();
      
      this.sessions.set(sessionId, session);
      await this.state.storage.put('sessions', this.sessions);
      
      return new Response(JSON.stringify({ session }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to update session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleDeleteSession(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('id');
    
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      await this.state.storage.put('sessions', this.sessions);
    }
    
    return new Response(JSON.stringify({ success: deleted }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private cleanExpiredSessions(): void {
    const now = Date.now();
    let changed = false;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.updatedAt > this.SESSION_TTL) {
        this.sessions.delete(sessionId);
        changed = true;
      }
    }
    
    if (changed) {
      this.state.storage.put('sessions', this.sessions);
    }
  }
}
```

## Calendar Data Caching

Create a Durable Object for caching calendar data:

```typescript
// src/durable-objects/calendar-cache.ts
import { Calendar, Event } from '../models/calendar';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CalendarCache implements DurableObject {
  private state: DurableObjectState;
  private cache: Map<string, CacheEntry<unknown>>;
  
  // Cache TTL: 5 minutes for most data
  private readonly DEFAULT_TTL = 5 * 60 * 1000;
  
  // User preferences TTL: 1 day
  private readonly PREFERENCES_TTL = 24 * 60 * 60 * 1000;
  
  constructor(state: DurableObjectState) {
    this.state = state;
    this.cache = new Map();
    
    // Initialize cache from storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, CacheEntry<unknown>>>('cache');
      if (stored) {
        this.cache = stored;
        this.cleanExpiredEntries();
      }
    });
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const userId = url.searchParams.get('userId') || 'default';
    
    // Route the request
    switch(true) {
      // Calendar operations
      case path === '/calendars' && request.method === 'GET':
        return this.handleGet<Calendar[]>(`calendars:${userId}`);
      
      case path === '/calendars' && request.method === 'PUT':
        return this.handlePut<Calendar[]>(`calendars:${userId}`, request);
      
      // Event operations
      case path.startsWith('/events/') && request.method === 'GET':
        const calendarId = path.split('/')[2];
        return this.handleGet<Event[]>(`events:${userId}:${calendarId}`);
      
      case path.startsWith('/events/') && request.method === 'PUT':
        const calId = path.split('/')[2];
        return this.handlePut<Event[]>(`events:${userId}:${calId}`, request);
      
      // User preferences
      case path === '/preferences' && request.method === 'GET':
        return this.handleGet<Record<string, unknown>>(`preferences:${userId}`, this.PREFERENCES_TTL);
      
      case path === '/preferences' && request.method === 'PUT':
        return this.handlePut<Record<string, unknown>>(`preferences:${userId}`, request, this.PREFERENCES_TTL);
      
      // Clear cache
      case path === '/clear' && request.method === 'DELETE':
        return this.handleClearCache(userId);
      
      default:
        return new Response('Not found', { status: 404 });
    }
  }
  
  private handleGet<T>(cacheKey: string, ttl: number = this.DEFAULT_TTL): Response {
    const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return new Response(JSON.stringify(cached.data), {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'X-Cache-Age': (Date.now() - cached.timestamp).toString()
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
  
  private async handlePut<T>(cacheKey: string, request: Request, ttl: number = this.DEFAULT_TTL): Promise<Response> {
    try {
      const data = await request.json() as T;
      
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      // Persist to storage
      await this.state.storage.put('cache', this.cache);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to update cache' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  private async handleClearCache(userId: string): Promise<Response> {
    // Find all keys for this user
    const userKeys = Array.from(this.cache.keys()).filter(key => key.includes(`:${userId}`));
    
    // Delete the keys
    for (const key of userKeys) {
      this.cache.delete(key);
    }
    
    // Persist changes
    await this.state.storage.put('cache', this.cache);
    
    return new Response(JSON.stringify({ 
      success: true,
      clearedEntries: userKeys.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  private cleanExpiredEntries(): void {
    const now = Date.now();
    let changed = false;
    
    for (const [key, entry] of this.cache.entries()) {
      const ttl = key.startsWith('preferences:') ? this.PREFERENCES_TTL : this.DEFAULT_TTL;
      
      if (now - entry.timestamp > ttl) {
        this.cache.delete(key);
        changed = true;
      }
    }
    
    if (changed) {
      this.state.storage.put('cache', this.cache);
    }
  }
}
```

## Integrating Durable Objects

Add Durable Objects to your environment configuration:

```typescript
// src/types/env.ts
export interface Env {
  // Secrets
  NEXTCLOUD_BASE_URL: string;
  NEXTCLOUD_USERNAME: string;
  NEXTCLOUD_APP_TOKEN: string;
  
  // Environment variables
  ENVIRONMENT: string;
  DEBUG_MODE: string;
  
  // Durable Objects
  SESSIONS: DurableObjectNamespace;
  CALENDAR_CACHE: DurableObjectNamespace;
}
```

Export the Durable Object classes in your `index.ts`:

```typescript
// src/index.ts
export { SessionStore } from './durable-objects/session-store';
export { CalendarCache } from './durable-objects/calendar-cache';

export default class CalendarWorker extends WorkerEntrypoint<Env> {
  // Worker implementation...
}
```

## Using Session Storage in MCP Tools

Integrate session storage with MCP tools:

```typescript
export default class CalendarWorker extends WorkerEntrypoint<Env> {
  private sessions: DurableObjectNamespace;
  
  constructor(env: Env) {
    super();
    this.sessions = env.SESSIONS;
  }
  
  async listCalendars(options?: { sessionId?: string }) {
    try {
      // Get or create session
      const sessionId = options?.sessionId || await this.createSession();
      const sessionData = await this.getSessionData(sessionId);
      
      // Use CalendarService with caching
      const calendarService = new EnhancedCalendarService(
        this.getNextcloudConfig(),
        this.env,
        sessionData.userId
      );
      
      const calendars = await calendarService.getCalendars();
      
      // Store result in session for future reference
      await this.updateSessionData(sessionId, {
        lastCalendarFetch: Date.now(),
        calendarCount: calendars.length
      });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, calendars }, null, 2)
          }
        ],
        context: {
          sessionId,
          calendarCount: calendars.length
        }
      };
    } catch (error) {
      return this.handleCalendarToolError('retrieve calendars', error);
    }
  }
  
  // Session management helper methods
  private async createSession(): Promise<string> {
    const sessionId = crypto.randomUUID();
    const id = this.sessions.idFromName(sessionId);
    const obj = this.sessions.get(id);
    
    const response = await obj.fetch('/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { createdBy: 'calendar-tool' } })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create session');
    }
    
    return sessionId;
  }
  
  private async getSessionData(sessionId: string): Promise<Record<string, unknown>> {
    const id = this.sessions.idFromName(sessionId);
    const obj = this.sessions.get(id);
    
    const response = await obj.fetch(`/get?id=${sessionId}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error('Failed to get session data');
    }
    
    const result = await response.json();
    return result.session.data;
  }
  
  private async updateSessionData(sessionId: string, data: Record<string, unknown>): Promise<void> {
    const id = this.sessions.idFromName(sessionId);
    const obj = this.sessions.get(id);
    
    await obj.fetch('/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, data })
    });
  }
}
```

## Storage Limits and Considerations

Durable Objects have storage limits that should be considered:

1. **Storage Capacity**: Durable Objects storage is limited to 128KB per key
2. **Number of Keys**: There's a limit on the total number of keys (up to 1GB total per namespace)
3. **Write Operations**: Minimize writes to reduce costs

Implement paging for large data sets:

```typescript
// Example of list with paging
async function listPaginatedData(
  state: DurableObjectState,
  prefix: string,
  pageSize: number = 100,
  startAfter?: string
): Promise<{ items: Array<unknown>; cursor?: string }> {
  const options: DurableObjectStorageListOptions = {
    prefix,
    limit: pageSize,
  };
  
  if (startAfter) {
    options.start = startAfter;
  }
  
  const entries = await state.storage.list(options);
  const items = Array.from(entries.values());
  
  let cursor: string | undefined;
  if (items.length === pageSize) {
    // More items might exist, return last key as cursor
    const lastKey = Array.from(entries.keys()).pop();
    if (lastKey) {
      cursor = lastKey;
    }
  }
  
  return { items, cursor };
}
```

## Testing Durable Objects

Use the Miniflare testing environment to test Durable Objects:

```typescript
import { Miniflare } from 'miniflare';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

describe('Session Store', () => {
  let mf: Miniflare;
  let sessionId: string;
  
  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: `
        export { SessionStore } from './src/durable-objects/session-store.ts';
        export default {}
      `,
      durableObjects: {
        SESSIONS: 'SessionStore'
      }
    });
  });
  
  afterAll(async () => {
    await mf.dispose();
  });
  
  test('should create a session', async () => {
    const ctx = mf.getWorkerContext();
    const res = await ctx.durableObjects.get('SESSIONS').fetch('/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { test: true } })
    });
    
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body).toHaveProperty('sessionId');
    expect(body).toHaveProperty('session');
    expect(body.session.data).toEqual({ test: true });
    
    sessionId = body.sessionId;
  });
  
  test('should get a session', async () => {
    const ctx = mf.getWorkerContext();
    const res = await ctx.durableObjects.get('SESSIONS').fetch(`/get?id=${sessionId}`, {
      method: 'GET'
    });
    
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body).toHaveProperty('session');
    expect(body.session.data).toEqual({ test: true });
  });
  
  test('should update a session', async () => {
    const ctx = mf.getWorkerContext();
    const res = await ctx.durableObjects.get('SESSIONS').fetch('/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionId, 
        data: { test: true, updated: true } 
      })
    });
    
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body).toHaveProperty('session');
    expect(body.session.data).toEqual({ test: true, updated: true });
  });
  
  test('should delete a session', async () => {
    const ctx = mf.getWorkerContext();
    const res = await ctx.durableObjects.get('SESSIONS').fetch(`/delete?id=${sessionId}`, {
      method: 'DELETE'
    });
    
    expect(res.status).toBe(200);
    
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });
});
```

## Next Steps

Once you have implemented state management with Durable Objects, proceed to configure authentication and security as described in [Authentication and Security](./07-auth-security.md).