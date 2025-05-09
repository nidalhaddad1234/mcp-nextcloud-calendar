#!/usr/bin/env node
// Import Express in a way compatible with both ESM and TypeScript
import express from 'express';
// Import the MCP server with now-proper type definitions
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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

// Validate environment variables
const validation = validateEnvironmentVariables();
if (validation.missing.length > 0) {
  console.warn('Some environment variables are missing:');
  validation.missing.forEach((variable) => {
    console.warn(`  - ${variable}`);
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
  console.warn('WARNING: Server is running with minimal configuration.');
  console.warn('Some features may not work correctly without proper server configuration.');
}

if (!validation.calendarReady) {
  console.warn('WARNING: Calendar service is disabled due to missing configuration.');
}

// Initialize services
let calendarService: CalendarService | null = null;
let eventService: EventService | null = null;

// Only try to initialize calendar service if all required environment variables are available
if (validation.calendarReady) {
  try {
    calendarService = new CalendarService(nextcloudConfig);
    eventService = new EventService(nextcloudConfig);
    console.log('Calendar and Event services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize calendar services:', error);
  }
} else {
  console.warn(
    'Calendar services not initialized due to missing environment variables:',
    ['NEXTCLOUD_BASE_URL', 'NEXTCLOUD_USERNAME', 'NEXTCLOUD_APP_TOKEN']
      .filter((varName) => !process.env[varName])
      .join(', '),
  );
  console.warn('Calendar-related functionality will not be available');
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
          return {
            isError: true,
            content: [{ type: 'text', text: 'No update parameters provided' }],
          };
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

// Register event tools if event service is available
if (eventService) {
  // List events tool
  server.tool(
    'listEvents',
    {
      calendarId: z.string(),
      start: z.string().optional(),
      end: z.string().optional(),
      limit: z.number().optional(),
      expandRecurring: z.boolean().optional(),
      priorityMinimum: z.number().optional(),
      adhdCategory: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async ({
      calendarId,
      start,
      end,
      limit,
      expandRecurring,
      priorityMinimum,
      adhdCategory,
      tags,
    }) => {
      try {
        // Parse dates if provided
        const startDate = start ? new Date(start) : undefined;
        const endDate = end ? new Date(end) : undefined;

        // Get events with filtering options
        const events = await eventService.getEvents(calendarId, {
          start: startDate,
          end: endDate,
          limit,
          expandRecurring,
          priorityMinimum,
          adhdCategory,
          tags,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, events }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleCalendarToolError('retrieve events', error);
      }
    },
  );

  // Get event by ID tool
  server.tool(
    'getEventById',
    {
      calendarId: z.string(),
      eventId: z.string(),
    },
    async ({ calendarId, eventId }) => {
      try {
        const event = await eventService.getEventById(calendarId, eventId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, event }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleCalendarToolError('retrieve event', error);
      }
    },
  );

  // Create event tool
  server.tool(
    'createEvent',
    {
      calendarId: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string(),
      isAllDay: z.boolean().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      color: z.string().optional(),
      status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
      visibility: z.enum(['public', 'private', 'confidential']).optional(),
      availability: z.enum(['free', 'busy']).optional(),
      adhdCategory: z.string().optional(),
      focusPriority: z.number().optional(),
      energyLevel: z.number().optional(),
      categories: z.array(z.string()).optional(),
      participants: z
        .array(
          z.object({
            email: z.string(),
            name: z.string().optional(),
            status: z.enum(['accepted', 'declined', 'tentative', 'needs-action']).optional(),
            role: z.enum(['required', 'optional']).optional(),
            type: z.enum(['individual', 'group', 'resource', 'room']).optional(),
          }),
        )
        .optional(),
      recurrenceRule: z
        .object({
          frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
          interval: z.number().optional(),
          until: z.string().optional(),
          count: z.number().optional(),
          byDay: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
          byMonthDay: z.array(z.number()).optional(),
          byMonth: z.array(z.number()).optional(),
        })
        .optional(),
      reminders: z
        .array(
          z.object({
            type: z.enum(['email', 'notification']),
            minutesBefore: z.number(),
          }),
        )
        .optional(),
    },
    async ({
      calendarId,
      title,
      start,
      end,
      isAllDay,
      description,
      location,
      color,
      status,
      visibility,
      availability,
      adhdCategory,
      focusPriority,
      energyLevel,
      categories,
      participants,
      recurrenceRule,
      reminders,
    }) => {
      try {
        // Parse dates
        const startDate = new Date(start);
        const endDate = new Date(end);

        // Handle recurrence rule if provided
        let processedRecurrenceRule;
        if (recurrenceRule) {
          processedRecurrenceRule = {
            ...recurrenceRule,
            until: recurrenceRule.until ? new Date(recurrenceRule.until) : undefined,
          };
        }

        // Create the event
        const event = await eventService.createEvent(calendarId, {
          calendarId,
          title,
          start: startDate,
          end: endDate,
          isAllDay: isAllDay ?? false,
          description,
          location,
          color,
          status,
          visibility,
          availability,
          adhdCategory,
          focusPriority,
          energyLevel,
          categories,
          participants: participants?.map((p) => ({
            ...p,
            status: p.status || 'needs-action',
          })),
          recurrenceRule: processedRecurrenceRule,
          reminders,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, event }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleCalendarToolError('create event', error);
      }
    },
  );

  // Update event tool
  server.tool(
    'updateEvent',
    {
      calendarId: z.string(),
      eventId: z.string(),
      title: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      isAllDay: z.boolean().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      color: z.string().optional(),
      status: z.enum(['confirmed', 'tentative', 'cancelled']).optional(),
      visibility: z.enum(['public', 'private', 'confidential']).optional(),
      availability: z.enum(['free', 'busy']).optional(),
      adhdCategory: z.string().optional(),
      focusPriority: z.number().optional(),
      energyLevel: z.number().optional(),
      categories: z.array(z.string()).optional(),
      participants: z
        .array(
          z.object({
            email: z.string(),
            name: z.string().optional(),
            status: z.enum(['accepted', 'declined', 'tentative', 'needs-action']).optional(),
            role: z.enum(['required', 'optional']).optional(),
            type: z.enum(['individual', 'group', 'resource', 'room']).optional(),
          }),
        )
        .optional(),
      recurrenceRule: z
        .object({
          frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
          interval: z.number().optional(),
          until: z.string().optional(),
          count: z.number().optional(),
          byDay: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
          byMonthDay: z.array(z.number()).optional(),
          byMonth: z.array(z.number()).optional(),
        })
        .optional(),
      reminders: z
        .array(
          z.object({
            type: z.enum(['email', 'notification']),
            minutesBefore: z.number(),
          }),
        )
        .optional(),
    },
    async ({
      calendarId,
      eventId,
      title,
      start,
      end,
      isAllDay,
      description,
      location,
      color,
      status,
      visibility,
      availability,
      adhdCategory,
      focusPriority,
      energyLevel,
      categories,
      participants,
      recurrenceRule,
      reminders,
    }) => {
      try {
        const updates: Record<string, unknown> = {};

        // Add all provided fields to the updates object
        if (title !== undefined) updates.title = title;
        if (start !== undefined) updates.start = new Date(start);
        if (end !== undefined) updates.end = new Date(end);
        if (isAllDay !== undefined) updates.isAllDay = isAllDay;
        if (description !== undefined) updates.description = description;
        if (location !== undefined) updates.location = location;
        if (color !== undefined) updates.color = color;
        if (status !== undefined) updates.status = status;
        if (visibility !== undefined) updates.visibility = visibility;
        if (availability !== undefined) updates.availability = availability;
        if (adhdCategory !== undefined) updates.adhdCategory = adhdCategory;
        if (focusPriority !== undefined) updates.focusPriority = focusPriority;
        if (energyLevel !== undefined) updates.energyLevel = energyLevel;
        if (categories !== undefined) updates.categories = categories;
        if (participants !== undefined)
          updates.participants = participants.map((p) => ({
            ...p,
            status: p.status || 'needs-action',
          }));

        // Process recurrence rule if provided
        if (recurrenceRule !== undefined) {
          const processedRecurrenceRule = {
            ...recurrenceRule,
            until: recurrenceRule.until ? new Date(recurrenceRule.until) : undefined,
          };
          updates.recurrenceRule = processedRecurrenceRule;
        }

        if (reminders !== undefined) updates.reminders = reminders;

        // Check if any updates were provided
        if (Object.keys(updates).length === 0) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'No update parameters provided' }],
          };
        }

        // Update the event
        const event = await eventService.updateEvent(calendarId, eventId, updates);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, event }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleCalendarToolError('update event', error);
      }
    },
  );

  // Delete event tool
  server.tool(
    'deleteEvent',
    {
      calendarId: z.string(),
      eventId: z.string(),
    },
    async ({ calendarId, eventId }) => {
      try {
        const result = await eventService.deleteEvent(calendarId, eventId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleCalendarToolError('delete event', error);
      }
    },
  );
}

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
  console.log('Shutting down gracefully...');
  server
    .close()
    .then(() => {
      console.log('Server closed');
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
  // Start the server
  httpServer = app.listen(serverConfig.port, () => {
    const ipAddresses = getServerIpAddresses();
    const serverName = serverConfig.serverName;
    const serverVersion = serverConfig.serverVersion;

    console.log('='.repeat(80));
    console.log(`Nextcloud Calendar MCP Server v${serverVersion}`);
    console.log('='.repeat(80));

    console.log(`\nEnvironment: ${serverConfig.environment}`);
    console.log(`Server name: ${serverName}`);

    console.log('\nEndpoints available:');
    console.log('-------------------');

    // Display MCP endpoint information for each IP address
    ipAddresses.forEach((ip) => {
      console.log(`MCP Streamable HTTP: http://${ip}:${serverConfig.port}/mcp`);
      console.log(`  - Supports GET (SSE streams), POST (messages), DELETE (session termination)`);
      console.log(`  - MCP Protocol: March 2025 Specification`);

      console.log(`\nLegacy HTTP+SSE endpoints:`);
      console.log(`  - SSE stream: http://${ip}:${serverConfig.port}/sse`);
      console.log(`  - Messages: http://${ip}:${serverConfig.port}/messages?sessionId=X`);
      console.log(`  - MCP Protocol: 2024-11-05 Specification (backward compatibility)`);
    });

    console.log('\nHealth check endpoint:');
    ipAddresses.forEach((ip) => {
      console.log(`  - http://${ip}:${serverConfig.port}/health`);
    });

    console.log('\nCalendar API endpoint:');
    ipAddresses.forEach((ip) => {
      console.log(`  - http://${ip}:${serverConfig.port}/api/calendars`);
    });

    console.log('\nServer is running and ready to accept connections.');
    console.log('='.repeat(80));
  });
}

// Export for testing
export { app, server, httpServer };
