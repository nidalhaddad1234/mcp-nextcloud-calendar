/**
 * Timezone-aware event tools for the MCP server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EventService } from '../services/calendar/event-service.js';
import { TimezoneService } from '../services/timezone-service.js';

/**
 * Register timezone-aware event tools
 */
export function registerTimezoneEventTools(
  server: McpServer,
  eventService: EventService,
  timezoneService: TimezoneService,
): void {
  if (!eventService || !timezoneService) {
    return;
  }

  // Get events with timezone formatting
  server.tool(
    'getEventsWithTimezone',
    {
      calendarId: z.string(),
      start: z.string().optional(),
      end: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ calendarId, start, end, limit }) => {
      try {
        // Parse dates if provided
        let startDate = start ? new Date(start) : undefined;
        let endDate = end ? new Date(end) : undefined;

        // Get events
        const events = await eventService.getEvents(calendarId, {
          start: startDate,
          end: endDate,
          limit,
        });

        // Format events with timezone information
        const timezoneInfo = timezoneService.getTimezoneInfo();
        const formattedEvents = events.map((event) => {
          return {
            ...event,
            // Original UTC times
            utcStart: event.start.toISOString(),
            utcEnd: event.end.toISOString(),

            // Timezone-aware formatting
            localStart: timezoneService.toLocal(event.start).toISOString(),
            localEnd: timezoneService.toLocal(event.end).toISOString(),
            formattedDateRange: timezoneService.formatDateRange(
              event.start,
              event.end,
              event.isAllDay,
            ),
            readableStart: event.isAllDay
              ? timezoneService.formatAllDay(event.start)
              : timezoneService.formatAsReadable(event.start),
            readableEnd: event.isAllDay
              ? timezoneService.formatAllDay(event.end)
              : timezoneService.formatAsReadable(event.end),
          };
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  timezone: timezoneInfo,
                  events: formattedEvents,
                  summary: {
                    total: events.length,
                    timezone: timezoneInfo.timezone,
                    timezoneOffset: timezoneInfo.offset,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        console.error('Error in getEventsWithTimezone tool:', error);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to get events with timezone: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    },
  );

  // Get timezone info
  server.tool('getTimezoneInfo', {}, async () => {
    try {
      const timezoneInfo = timezoneService.getTimezoneInfo();
      const now = timezoneService.now();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                timezone: timezoneInfo.timezone,
                offset: timezoneInfo.offset,
                name: timezoneInfo.name,
                currentTime: {
                  utc: new Date().toISOString(),
                  local: now.toISOString(),
                  formatted: timezoneService.formatAsReadable(now),
                },
                isDST: timezoneService.isDST(now),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      console.error('Error in getTimezoneInfo tool:', error);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Failed to get timezone info: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  });
}
