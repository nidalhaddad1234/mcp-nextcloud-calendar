import express from 'express';
type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;
import { CalendarService } from '../services/index.js';

export function getCalendarsHandler(calendarService: CalendarService | null) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!calendarService) {
      res.status(503).json({ error: 'Calendar service not available' });
      return;
    }

    calendarService
      .getCalendars()
      .then((calendars) => {
        res.status(200).json({ calendars });
      })
      .catch((error) => {
        console.error('Error getting calendars:', error);
        res.status(500).json({ error: `Failed to get calendars: ${(error as Error).message}` });
      });
  };
}
