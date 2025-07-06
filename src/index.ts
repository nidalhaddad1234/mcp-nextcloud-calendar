#!/usr/bin/env node

// ===== MCP PROTOCOL COMPLIANCE =====
// Force disable all colored output to ensure MCP protocol compliance
// The MCP protocol requires ONLY JSON-RPC messages on stdout
// All debug/logging output must go to stderr without ANSI escape sequences
process.env.NO_COLOR = '1';
process.env.FORCE_COLOR = '0';
process.env.NODE_DISABLE_COLORS = '1';

// Import Express in a way compatible with both ESM and TypeScript
import express from 'express';
// Import the MCP server with now-proper type definitions
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig, validateEnvironmentVariables } from './config/config.js';
import { healthHandler } from './handlers/health.js';
import { setupMcpTransport } from './handlers/mcp-transport.js';
import { getCalendarsHandler, sanitizeError } from './handlers/calendars.js';
import { CalendarService, EventService } from './services/index.js';
import * as os from 'node:os';

/**
 * Utility function to handle and sanitize errors for MCP calendar tools
 * @param operation The calendar operation being performed (e.g., 'retrieve calendars')
 * @param error The original error
 * @returns A formatted MCP tool error response
 */
export function handleCalendarToolError(operation: string, error: unknown) {
  console.error(`Error in ${operation} tool:`, error);

  // Sanitize error message to avoid exposing sensitive details
  const { message: sanitizedMessage } = sanitizeError(error);

  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `Failed to ${operation}: ${sanitizedMessage}`,
      },
    ],
  };
}

// Detect if we're running in stdio mode (launched by Claude Desktop)
// vs HTTP mode (standalone server)
const isStdioMode = !process.stdout.isTTY || process.argv.includes('--stdio');

if (isStdioMode) {
  console.error('Starting in stdio mode for MCP client connection...');
} else {
  console.error('Starting in HTTP server mode...');
}

// Validate environment variables
const validation = validateEnvironmentVariables();
if (validation.missing.length > 0) {
  console.error('Some environment variables are missing:');
  validation.missing.forEach((variable) => {
    console.error(`  - ${variable}`);
  });
}

// Check if we have valid configuration to start the server
if (!validation.isValid) {
  console.error('ERROR: Invalid configuration. Server cannot start.');
  console.error('Please provide the required environment variables and restart the server.');
  process.exit(1);
}

// Load configuration
const config = loadConfig();
const { server: serverConfig, nextcloud: nextcloudConfig } = config;

// Show a clear message about what features are available
if (!validation.serverReady) {
  console.error('WARNING: Server is running with minimal configuration.');
  console.error('Some features may not work correctly without proper server configuration.');
}

if (!validation.calendarReady) {
  console.error('WARNING: Calendar service is disabled due to missing configuration.');
}

// Initialize services
let calendarService: CalendarService | null = null;
let eventService: EventService | null = null;

// Only try to initialize calendar service if all required environment variables are available
if (validation.calendarReady) {
  try {
    calendarService = new CalendarService(nextcloudConfig);
    console.error('Calendar service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize calendar service:', error);
  }

  try {
    if (calendarService) {
      eventService = new EventService(nextcloudConfig);
      console.error('Event service initialized successfully');
    }
  } catch (error) {
    console.error('Failed to initialize event service:', error);
    eventService = null;
  }
} else {
  console.error(
    'Calendar services not initialized due to missing environment variables:',
    ['NEXTCLOUD_BASE_URL', 'NEXTCLOUD_USERNAME', 'NEXTCLOUD_APP_TOKEN']
      .filter((varName) => !process.env[varName])
      .join(', '),
  );
  console.error('Calendar-related functionality will not be available');
}

// Import zod for parameter validation
import { z } from 'zod';

// Create MCP server
const server = new McpServer({
  name: serverConfig.serverName,
  version: serverConfig.serverVersion,
});

// Register calendar tools if calendar service is available
if (calendarService) {
  // List calendars tool
  server.tool('listCalendars', {}, async () => {
    try {
      const calendars = await calendarService.getCalendars();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, calendars }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleCalendarToolError('retrieve calendars', error);
    }
  });

  // Create calendar tool
  server.tool(
    'createCalendar',
    {
      displayName: z.string(),
      color: z.string().optional(),
      category: z.string().optional(),
      focusPriority: z.number().optional(),
    },
    async ({ displayName, color, category, focusPriority }) => {
      try {
        const newCalendar = {
          displayName,
          color: color || '#0082c9',
          owner: '', // Will be assigned by service
          isDefault: false,
          isShared: false,
          isReadOnly: false,
          permissions: {
            canRead: true,
            canWrite: true,
            canShare: true,
            canDelete: true,
          },
          category,
          focusPriority,
          metadata: null,
        };

        const calendar = await calendarService.createCalendar(newCalendar);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, calendar }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleCalendarToolError('create calendar', error);
      }
    },
  );

  // Update calendar tool
  server.tool(
    'updateCalendar',
    {
      id: z.string(),
      displayName: z.string().optional(),
      color: z.string().optional(),
      category: z.string().optional(),
      focusPriority: z.number().optional(),
    },
    async ({ id, displayName, color, category, focusPriority }) => {
      try {
        const updates: Record<string, unknown> = {};
        if (displayName !== undefined) updates.displayName = displayName;
        if (color !== undefined) updates.color = color;
        if (category !== undefined) updates.category = category;
        if (focusPriority !== undefined) updates.focusPriority = focusPriority;

        if (Object.keys(updates).length === 0) {
          throw new Error('No update parameters provided');
        }

        const calendar = await calendarService.updateCalendar(id, updates);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, calendar }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleCalendarToolError('update calendar', error);
      }
    },
  );

  // Delete calendar tool
  server.tool(
    'deleteCalendar',
    {
      id: z.string(),
    },
    async ({ id }) => {
      try {
        const result = await calendarService.deleteCalendar(id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleCalendarToolError('delete calendar', error);
      }
    },
  );
}

// Register event tools
import { registerEventTools } from './handlers/event-tools.js';
if (eventService) {
  registerEventTools(server, eventService);
}

// Choose transport based on how we're running
if (isStdioMode) {
  // Stdio mode for Claude Desktop
  console.error('Connecting via stdio transport for MCP client...');
  
  const transport = new StdioServerTransport();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Received SIGINT, shutting down gracefully...');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Received SIGTERM, shutting down gracefully...');
    await server.close();
    process.exit(0);
  });

  // Connect the server to the transport
  server.connect(transport).then(() => {
    console.error('MCP server connected via stdio transport');
  }).catch((error) => {
    console.error('Failed to connect MCP server:', error);
    process.exit(1);
  });

} else {
  // HTTP mode for standalone testing
  console.error('Starting HTTP server for standalone mode...');
  
  // Setup Express app
  const app = express();
  app.use(express.json());

  // Setup handlers
  const { mcpHandler, sseHandler, messageHandler } = setupMcpTransport(server);

  // Configure routes
  app.get('/health', healthHandler(serverConfig));

  // Modern Streamable HTTP endpoint
  app.all('/mcp', mcpHandler);

  // Legacy HTTP+SSE transport endpoints (for backward compatibility)
  app.get('/sse', sseHandler);
  app.post('/messages', messageHandler);

  // Calendar routes
  app.get('/api/calendars', getCalendarsHandler(calendarService));

  // Graceful shutdown handling
  const gracefulShutdown = () => {
    console.error('Shutting down gracefully...');
    server
      .close()
      .then(() => {
        console.error('Server closed');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error during shutdown:', err);
        process.exit(1);
      });
  };

  // Handle termination signals
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  // Get server's IP address(es)
  function getServerIpAddresses(): string[] {
    const nets = os.networkInterfaces();
    const results: string[] = [];

    for (const name of Object.keys(nets)) {
      // Type assertion needed since TypeScript doesn't know the structure
      const interfaces = nets[name];
      if (!interfaces) continue;

      for (const net of interfaces) {
        // Skip internal and non-IPv4 addresses
        if (!net.internal && net.family === 'IPv4') {
          results.push(net.address);
        }
      }
    }

    return results.length ? results : ['localhost'];
  }

  // For testing environments, we'll optionally avoid starting the server
  let httpServer: ReturnType<typeof app.listen> | null = null;

  // Only start the server if we're not in a test environment or if the test explicitly wants a server
  if (process.env.NODE_ENV !== 'test') {
    // Start the HTTP server
    httpServer = app.listen(serverConfig.port, () => {
      const ipAddresses = getServerIpAddresses();
      const serverName = serverConfig.serverName;
      const serverVersion = serverConfig.serverVersion;

      console.error('='.repeat(80));
      console.error(`Nextcloud Calendar MCP Server v${serverVersion}`);
      console.error('='.repeat(80));

      console.error(`\nEnvironment: ${serverConfig.environment}`);
      console.error(`Server name: ${serverName}`);

      console.error('\nEndpoints available:');
      console.error('-------------------');

      // Display MCP endpoint information for each IP address
      ipAddresses.forEach((ip) => {
        console.error(`MCP Streamable HTTP: http://${ip}:${serverConfig.port}/mcp`);
        console.error(`  - Supports GET (SSE streams), POST (messages), DELETE (session termination)`);
        console.error(`  - MCP Protocol: March 2025 Specification`);

        console.error(`\nLegacy HTTP+SSE endpoints:`);
        console.error(`  - SSE stream: http://${ip}:${serverConfig.port}/sse`);
        console.error(`  - Messages: http://${ip}:${serverConfig.port}/messages?sessionId=X`);
        console.error(`  - MCP Protocol: 2024-11-05 Specification (backward compatibility)`);
      });

      console.error('\nHealth check endpoint:');
      ipAddresses.forEach((ip) => {
        console.error(`  - http://${ip}:${serverConfig.port}/health`);
      });

      console.error('\nCalendar API endpoint:');
      ipAddresses.forEach((ip) => {
        console.error(`  - http://${ip}:${serverConfig.port}/api/calendars`);
      });

      console.error('\nServer is running and ready to accept connections.');
      console.error('='.repeat(80));
    });
  }

  // Export for testing
  export { app, server, httpServer };
}
