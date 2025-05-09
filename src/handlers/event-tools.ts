import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EventService, EventHelpers } from '../services/calendar/index.js';
// Import handleCalendarToolError
// This needs to be defined here to avoid circular dependencies
function handleCalendarToolError(operation: string, error: unknown) {
  console.error(`Error in ${operation} tool:`, error);

  // Basic error sanitization
  const errorMessage = error instanceof Error ? error.message : String(error);
  const sanitizedMessage = errorMessage.replace(
    /username|password|token|secret|key/gi,
    '[REDACTED]',
  );

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

/**
 * Register event-related tools with the MCP server
 * @param server The MCP server instance
 * @param eventService The event service instance
 */
export function registerEventTools(server: McpServer, eventService: EventService): void {
  if (!eventService) {
    return;
  }

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
        // Parse and validate dates if provided
        let startDate = undefined;
        let endDate = undefined;

        if (start) {
          startDate = EventHelpers.validateDate(start, 'start');
        }

        if (end) {
          endDate = EventHelpers.validateDate(end, 'end');
        }

        // Validate date range if both dates are provided
        if (startDate && endDate) {
          EventHelpers.validateDateRange(startDate, endDate);
        }

        // Validate adhdCategory if provided
        const validatedAdhdCategory = adhdCategory
          ? EventHelpers.validateAdhdCategory(adhdCategory)
          : undefined;

        // Get events with filtering options
        const events = await eventService.getEvents(calendarId, {
          start: startDate,
          end: endDate,
          limit,
          expandRecurring,
          priorityMinimum,
          adhdCategory: validatedAdhdCategory,
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
        // Parse and validate dates using helper function
        const startDate = EventHelpers.validateDate(start, 'start');
        const endDate = EventHelpers.validateDate(end, 'end');

        // Validate date range (start must be before end)
        EventHelpers.validateDateRange(startDate, endDate);

        // Process recurrence rule if provided using helper function
        const processedRecurrenceRule = recurrenceRule
          ? EventHelpers.processRecurrenceRule(recurrenceRule)
          : undefined;

        // Validate ADHD category if provided
        const validatedAdhdCategory = adhdCategory
          ? EventHelpers.validateAdhdCategory(adhdCategory)
          : undefined;

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
          adhdCategory: validatedAdhdCategory,
          focusPriority: EventHelpers.validateFocusPriority(focusPriority),
          energyLevel: EventHelpers.validateEnergyLevel(energyLevel),
          categories,
          participants: EventHelpers.validateParticipants(participants),
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

        // Parse and validate dates using helper function
        if (start !== undefined) {
          updates.start = EventHelpers.validateDate(start, 'start');
        }

        if (end !== undefined) {
          updates.end = EventHelpers.validateDate(end, 'end');
        }

        // If both dates are provided, validate the date range
        if (updates.start && updates.end) {
          EventHelpers.validateDateRange(updates.start as Date, updates.end as Date);
        }

        if (isAllDay !== undefined) updates.isAllDay = isAllDay;
        if (description !== undefined) updates.description = description;
        if (location !== undefined) updates.location = location;
        if (color !== undefined) updates.color = color;
        if (status !== undefined) updates.status = status;
        if (visibility !== undefined) updates.visibility = visibility;
        if (availability !== undefined) updates.availability = availability;

        // Validate and sanitize custom fields using helper functions
        if (adhdCategory !== undefined) {
          updates.adhdCategory = EventHelpers.validateAdhdCategory(adhdCategory);
        }

        if (focusPriority !== undefined) {
          updates.focusPriority = EventHelpers.validateFocusPriority(focusPriority);
        }

        if (energyLevel !== undefined) {
          updates.energyLevel = EventHelpers.validateEnergyLevel(energyLevel);
        }

        if (categories !== undefined) updates.categories = categories;

        if (participants !== undefined) {
          updates.participants = EventHelpers.validateParticipants(participants);
        }

        // Process recurrence rule if provided using helper function
        if (recurrenceRule !== undefined) {
          updates.recurrenceRule = EventHelpers.processRecurrenceRule(recurrenceRule);
        }

        if (reminders !== undefined) updates.reminders = reminders;

        // Check if any updates were provided
        if (Object.keys(updates).length === 0) {
          throw new Error('No update parameters provided');
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
