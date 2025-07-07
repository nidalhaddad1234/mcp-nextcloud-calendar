#!/usr/bin/env node

// ===== MCP PROTOCOL COMPLIANCE =====
// Force disable all colored output to ensure MCP protocol compliance
// The MCP protocol requires ONLY JSON-RPC messages on stdout
// All debug/logging output must go to stderr without ANSI escape sequences
process.env.NO_COLOR = '1';
process.env.FORCE_COLOR = '0';
process.env.NODE_DISABLE_COLORS = '1';

// Import the MCP server with proper type definitions
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig, validateEnvironmentVariables } from './config/config.js';
import { sanitizeError } from './utils/error.js';
import { CalendarService, EventService, ContactService } from './services/index.js';
import { TimezoneService } from './services/timezone-service.js';
import { z } from 'zod';

/**
 * Utility function to handle and sanitize errors for MCP calendar tools
 * @param operation The calendar operation being performed (e.g., 'retrieve calendars')
 * @param error The original error
 * @returns A formatted MCP tool error response
 */
function handleCalendarToolError(operation: string, error: unknown) {
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

async function main() {
  console.error('Starting Nextcloud Calendar MCP Server for Claude Desktop...');

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

  // Show warnings for missing configuration
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
  let contactService: ContactService | null = null;
  let timezoneService: TimezoneService | null = null;

  // Initialize timezone service (always available)
  timezoneService = new TimezoneService(
    nextcloudConfig.defaultTimezone || 'Europe/Paris',
    nextcloudConfig.useLocalTimezone !== false,
  );
  console.error('Timezone service initialized:', timezoneService.getTimezoneInfo().timezone);

  // Only try to initialize calendar service if all required environment variables are available
  if (validation.calendarReady) {
    try {
      calendarService = new CalendarService(nextcloudConfig);
      console.error('Calendar service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize calendar service:', error);
      process.exit(1);
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

    try {
      contactService = new ContactService(nextcloudConfig);
      console.error('Contact service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize contact service:', error);
      contactService = null;
    }
  } else {
    console.error(
      'Calendar services not initialized due to missing environment variables:',
      ['NEXTCLOUD_BASE_URL', 'NEXTCLOUD_USERNAME', 'NEXTCLOUD_APP_TOKEN']
        .filter((varName) => !process.env[varName])
        .join(', '),
    );
    console.error('Calendar-related functionality will not be available');
    process.exit(1);
  }

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
        const calendars = await calendarService!.getCalendars();
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

          const calendar = await calendarService!.createCalendar(newCalendar);
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

          const calendar = await calendarService!.updateCalendar(id, updates);
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
          const result = await calendarService!.deleteCalendar(id);
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
  if (eventService) {
    const { registerEventTools } = await import('./handlers/event-tools.js');
    registerEventTools(server, eventService);
  }

  // Register timezone-aware tools
  if (eventService && timezoneService) {
    const { registerTimezoneEventTools } = await import('./handlers/timezone-tools.js');
    registerTimezoneEventTools(server, eventService, timezoneService);
  }

  // Register contact tools
  if (contactService) {
    const { registerContactTools } = await import('./handlers/contact-tools.js');
    registerContactTools(server, contactService);
  }

  // Create stdio transport for Claude Desktop
  const transport = new StdioServerTransport();

  // Add error handling
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
  });

  // Connect the server to the stdio transport
  try {
    await server.connect(transport);
    console.error('MCP server started successfully - ready for Claude Desktop');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
