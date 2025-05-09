# Authentication and Security

This document covers authentication and security considerations for the Cloudflare Workers migration.

## Authentication Flow

### Token-Based Authentication

When migrating from Express to Cloudflare Workers, implement secure token handling:

```typescript
// src/utils/auth.ts
export interface AuthToken {
  userId: string;
  expiresAt: number;
  scope: string[];
}

export function generateAuthToken(userId: string, scope: string[] = ['read']): string {
  // Create token payload
  const payload: AuthToken = {
    userId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    scope
  };
  
  // In a real implementation, use a proper encryption library
  // This is a simplified example
  const token = btoa(JSON.stringify(payload));
  
  // In production, use a proper signing method
  const signature = createHmac(token);
  
  return `${token}.${signature}`;
}

export function verifyAuthToken(token: string): AuthToken | null {
  try {
    const [payload, signature] = token.split('.');
    
    // Verify signature
    const expectedSignature = createHmac(payload);
    if (signature !== expectedSignature) {
      return null;
    }
    
    // Decode token
    const decodedPayload = JSON.parse(atob(payload)) as AuthToken;
    
    // Check if token is expired
    if (decodedPayload.expiresAt < Date.now()) {
      return null;
    }
    
    return decodedPayload;
  } catch (error) {
    return null;
  }
}

// Simple HMAC implementation for demonstration
function createHmac(data: string): string {
  // In production, use a proper crypto library
  // This is a simplified example
  return btoa(data + 'SECRET_KEY').substring(0, 32);
}
```

### CSRF Protection

Implement CSRF protection for sensitive operations:

```typescript
// src/middleware/csrf.ts
export function generateCsrfToken(sessionId: string): string {
  // Create HMAC-based token with timestamp
  const timestamp = Date.now();
  const message = `${sessionId}:${timestamp}`;
  
  // In a real implementation, use a proper HMAC function
  // This is a simplified example
  const signature = hashString(message + CSRF_SECRET);
  return `${timestamp}:${signature}`;
}

export function validateCsrfToken(token: string, sessionId: string): boolean {
  const [timestamp, signature] = token.split(':');
  
  // Check token age (10 minute expiry)
  const now = Date.now();
  if (now - parseInt(timestamp) > 10 * 60 * 1000) {
    return false;
  }
  
  // Verify signature
  const message = `${sessionId}:${timestamp}`;
  const expectedSignature = hashString(message + CSRF_SECRET);
  return signature === expectedSignature;
}

// Simple hash function for demonstration
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
```

### Secure Headers

Implement security headers for all responses:

```typescript
// src/middleware/security-headers.ts
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  // Add security headers
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Content-Security-Policy', "default-src 'self'");
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Example of using the security headers
export default class CalendarWorker extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    try {
      // Process the request
      const response = await this.handleRequest(request);
      
      // Add security headers
      return addSecurityHeaders(response);
    } catch (error) {
      // Handle error
      return addSecurityHeaders(
        new Response(JSON.stringify({ error: 'Internal error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      );
    }
  }
  
  private async handleRequest(request: Request): Promise<Response> {
    // Request handling logic...
  }
}
```

## Nextcloud Authentication

### Secure Storage of Credentials

Store Nextcloud credentials securely using Cloudflare Secret Manager:

```bash
# Securely set Nextcloud credentials
wrangler secret put NEXTCLOUD_BASE_URL
wrangler secret put NEXTCLOUD_USERNAME
wrangler secret put NEXTCLOUD_APP_TOKEN
```

Retrieve the secrets in your Worker:

```typescript
// src/services/calendar/http-client.ts
export class HttpClient {
  private baseUrl: string;
  private authHeader: string;
  
  constructor(env: Env) {
    this.baseUrl = env.NEXTCLOUD_BASE_URL;
    this.authHeader = 'Basic ' + btoa(`${env.NEXTCLOUD_USERNAME}:${env.NEXTCLOUD_APP_TOKEN}`);
  }
  
  // HTTP methods...
}
```

### Token Rotation

Implement token rotation for Nextcloud app tokens:

```typescript
// src/services/token-manager.ts
export class TokenManager {
  private state: DurableObjectState;
  private tokens: Map<string, { value: string; expiresAt: number }>;
  
  // Token expiry time: 30 days
  private readonly TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;
  
  constructor(state: DurableObjectState) {
    this.state = state;
    this.tokens = new Map();
    
    // Initialize from storage
    this.state.blockConcurrencyWhile(async () => {
      const storedTokens = await this.state.storage.get('tokens');
      if (storedTokens) {
        this.tokens = storedTokens;
      }
    });
  }
  
  async getToken(userId: string): Promise<string> {
    const tokenEntry = this.tokens.get(userId);
    
    // If token exists and is not expired, return it
    if (tokenEntry && tokenEntry.expiresAt > Date.now()) {
      return tokenEntry.value;
    }
    
    // Otherwise, generate a new token
    const newToken = await this.generateToken(userId);
    return newToken;
  }
  
  private async generateToken(userId: string): Promise<string> {
    // In a real implementation, this would call the Nextcloud API to generate a new app token
    // This is a simplified example
    const newToken = crypto.randomUUID();
    
    this.tokens.set(userId, {
      value: newToken,
      expiresAt: Date.now() + this.TOKEN_TTL
    });
    
    await this.state.storage.put('tokens', this.tokens);
    
    return newToken;
  }
}
```

## XML Security

### XXE Attack Prevention

Ensure XML parsing is secure against XXE (XML External Entity) attacks:

```typescript
export class SecureXmlParser {
  parse(xmlString: string): Document {
    // Use DOMParser with XXE protections
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error(`XML parsing failed: ${parserError.textContent}`);
    }
    
    // Check for DOCTYPE (potential XXE vector)
    if (xmlDoc.doctype) {
      throw new Error("DOCTYPE is not allowed for security reasons");
    }
    
    // Verify no external entities
    this.checkForExternalEntities(xmlString);
    
    return xmlDoc;
  }
  
  private checkForExternalEntities(xmlString: string): void {
    // Check for DOCTYPE with SYSTEM or PUBLIC
    if (
      /<!DOCTYPE\s+[^>]*?\s+SYSTEM\s/.test(xmlString) ||
      /<!DOCTYPE\s+[^>]*?\s+PUBLIC\s/.test(xmlString)
    ) {
      throw new Error("External entities are not allowed");
    }
    
    // Check for ENTITY declarations
    if (/<!ENTITY\s+[^>]*?SYSTEM\s/.test(xmlString)) {
      throw new Error("External entity declarations are not allowed");
    }
  }
}
```

### XML Bomb Prevention

Implement protection against XML bombs (billion laughs attack):

```typescript
export class XmlBombDetector {
  private readonly MAX_ENTITY_EXPANSIONS = 10000;
  private readonly MAX_ENTITY_DEPTH = 3;
  private readonly MAX_ATTRIBUTES = 500;
  private readonly MAX_XML_SIZE = 1024 * 1024; // 1MB
  
  checkXmlForBombs(xmlString: string): void {
    // Check XML size
    if (xmlString.length > this.MAX_XML_SIZE) {
      throw new Error("XML too large - potential XML bomb attack");
    }
    
    // Check for entity declarations
    const entityCount = (xmlString.match(/<!ENTITY/g) || []).length;
    if (entityCount > this.MAX_ENTITY_EXPANSIONS) {
      throw new Error("Too many entity declarations - potential XML bomb attack");
    }
    
    // Check for nested entities (often used in billion laughs attack)
    const nestedEntityPattern = /<!ENTITY\s+(\w+)\s+["'][^"']*?&(\w+);[^"']*?["']/g;
    let match;
    while ((match = nestedEntityPattern.exec(xmlString)) !== null) {
      throw new Error("Nested entity references not allowed - potential XML bomb attack");
    }
    
    // Check for excessive attributes (quadratic blowup attack)
    const attributeCount = (xmlString.match(/\s\w+\s*=\s*["'][^"']*?["']/g) || []).length;
    if (attributeCount > this.MAX_ATTRIBUTES) {
      throw new Error("Too many attributes - potential XML bomb attack");
    }
  }
}
```

## OAuth Integration

Implement OAuth for user authentication:

```typescript
// src/services/oauth.ts
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
}

export class OAuthService {
  private config: OAuthConfig;
  
  constructor(config: OAuthConfig) {
    this.config = config;
  }
  
  generateAuthUrl(state: string, scope: string[] = ['read']): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: scope.join(' '),
      state
    });
    
    return `${this.config.authorizationEndpoint}?${params.toString()}`;
  }
  
  async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
      code
    });
    
    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    
    if (!response.ok) {
      throw new Error(`Failed to exchange code: ${response.status}`);
    }
    
    return response.json();
  }
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}
```

## Multi-User Authorization

Implement user-specific access controls:

```typescript
// src/services/auth/access-control.ts
export enum Permission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  SHARE = 'share',
  ADMIN = 'admin'
}

export interface AccessPolicy {
  calendarId: string;
  userId: string;
  permissions: Permission[];
}

export class AccessControl {
  private state: DurableObjectState;
  private policies: Map<string, AccessPolicy[]>;
  
  constructor(state: DurableObjectState) {
    this.state = state;
    this.policies = new Map();
    
    // Initialize from storage
    this.state.blockConcurrencyWhile(async () => {
      const storedPolicies = await this.state.storage.get('policies');
      if (storedPolicies) {
        this.policies = storedPolicies;
      }
    });
  }
  
  async hasPermission(userId: string, calendarId: string, permission: Permission): Promise<boolean> {
    const userPolicies = this.policies.get(userId) || [];
    
    // Find policy for this calendar
    const policy = userPolicies.find(p => p.calendarId === calendarId);
    if (!policy) {
      return false;
    }
    
    // Check if user has the required permission
    return policy.permissions.includes(permission);
  }
  
  async addPolicy(policy: AccessPolicy): Promise<void> {
    let userPolicies = this.policies.get(policy.userId) || [];
    
    // Remove existing policy for this calendar if it exists
    userPolicies = userPolicies.filter(p => p.calendarId !== policy.calendarId);
    
    // Add new policy
    userPolicies.push(policy);
    
    // Update policies
    this.policies.set(policy.userId, userPolicies);
    
    // Persist to storage
    await this.state.storage.put('policies', this.policies);
  }
  
  async removePolicy(userId: string, calendarId: string): Promise<void> {
    const userPolicies = this.policies.get(userId) || [];
    
    // Remove policy for this calendar
    const updatedPolicies = userPolicies.filter(p => p.calendarId !== calendarId);
    
    // Update policies
    if (updatedPolicies.length > 0) {
      this.policies.set(userId, updatedPolicies);
    } else {
      this.policies.delete(userId);
    }
    
    // Persist to storage
    await this.state.storage.put('policies', this.policies);
  }
}
```

## Rate Limiting

Implement rate limiting to protect against abuse:

```typescript
// src/middleware/rate-limit.ts
export class RateLimiter {
  private state: DurableObjectState;
  private limits: Map<string, { count: number; resetAt: number }>;
  
  constructor(state: DurableObjectState) {
    this.state = state;
    this.limits = new Map();
    
    // Initialize from storage
    this.state.blockConcurrencyWhile(async () => {
      const storedLimits = await this.state.storage.get('limits');
      if (storedLimits) {
        this.limits = storedLimits;
      }
    });
  }
  
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    let entry = this.limits.get(key);
    
    // If no entry or window has expired, create a new one
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + (windowSeconds * 1000)
      };
    }
    
    // Check if limit is exceeded
    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt
      };
    }
    
    // Increment count
    entry.count += 1;
    this.limits.set(key, entry);
    
    // Persist to storage (could be optimized to batch updates)
    await this.state.storage.put('limits', this.limits);
    
    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: entry.resetAt
    };
  }
}
```

## Error Handling

Implement secure error handling to avoid exposing sensitive information:

```typescript
// src/utils/error-handler.ts
export function sanitizeError(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    // Remove sensitive information from error message
    let message = error.message;
    
    // Remove potential connection strings, tokens or passwords
    message = message.replace(/(?:password|token|key|secret)=\S+/gi, '$1=REDACTED');
    message = message.replace(/(?:https?:\/\/)([^:]+:)([^@]+)@/gi, '$1REDACTED@');
    
    // For known error types, return appropriate error codes
    if (error.name === 'AuthenticationError') {
      return { message: 'Authentication failed', code: 'AUTH_ERROR' };
    }
    
    if (error.name === 'NotFoundError') {
      return { message: 'Resource not found', code: 'NOT_FOUND' };
    }
    
    return { message };
  }
  
  // For unknown errors, return a generic message
  return { message: 'An unexpected error occurred' };
}
```

## Security Testing

### Test CSRF Protection

```typescript
import { describe, test, expect } from 'vitest';
import { generateCsrfToken, validateCsrfToken } from '../src/middleware/csrf';

describe('CSRF Protection', () => {
  test('should generate and validate CSRF tokens', () => {
    const sessionId = 'test-session';
    const token = generateCsrfToken(sessionId);
    
    expect(token).toBeDefined();
    expect(token.split(':').length).toBe(2);
    
    const isValid = validateCsrfToken(token, sessionId);
    expect(isValid).toBe(true);
  });
  
  test('should reject invalid tokens', () => {
    const sessionId = 'test-session';
    const invalidToken = '1234567890:invalid-signature';
    
    const isValid = validateCsrfToken(invalidToken, sessionId);
    expect(isValid).toBe(false);
  });
  
  test('should reject expired tokens', () => {
    const sessionId = 'test-session';
    
    // Create token with timestamp 11 minutes ago (beyond 10 min expiry)
    const timestamp = Date.now() - (11 * 60 * 1000);
    const message = `${sessionId}:${timestamp}`;
    const signature = hashString(message + 'CSRF_SECRET');
    const expiredToken = `${timestamp}:${signature}`;
    
    const isValid = validateCsrfToken(expiredToken, sessionId);
    expect(isValid).toBe(false);
  });
});
```

### Test XML Security

```typescript
import { describe, test, expect } from 'vitest';
import { SecureXmlParser, XmlBombDetector } from '../src/utils/xml-security';

describe('XML Security', () => {
  test('should detect XXE attacks', () => {
    const parser = new SecureXmlParser();
    const maliciousXml = `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
      <calendar>
        <name>&xxe;</name>
      </calendar>`;
    
    expect(() => parser.parse(maliciousXml)).toThrow();
  });
  
  test('should detect XML bombs', () => {
    const detector = new XmlBombDetector();
    const billionLaughsXml = `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE lolz [
        <!ENTITY lol "lol">
        <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
        <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
      ]>
      <lolz>&lol2;</lolz>`;
    
    expect(() => detector.checkXmlForBombs(billionLaughsXml)).toThrow();
  });
});
```

## Next Steps

Once you have implemented authentication and security measures, proceed to set up multi-tenant support as described in [Multi-tenant Support](./08-multi-tenant.md).