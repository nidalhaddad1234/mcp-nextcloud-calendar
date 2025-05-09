/**
 * Common test fixtures
 */
import { ModelFactory } from './model-factory.js';
import { Calendar, Event } from '../../models/calendar.js';

/**
 * Collection of test fixtures
 */
export const Fixtures = {
  /**
   * Standard calendar collection with different permission scenarios
   */
  calendars: {
    /**
     * Personal calendar with full permissions
     */
    personal: ModelFactory.createCalendar({
      id: 'personal',
      displayName: 'Personal',
      color: '#0082c9',
      owner: 'testuser',
      isDefault: true,
      permissions: {
        canRead: true,
        canWrite: true,
        canShare: true,
        canDelete: true,
      },
    }),

    /**
     * Work calendar with full permissions
     */
    work: ModelFactory.createCalendar({
      id: 'work',
      displayName: 'Work',
      color: '#FF0000',
      owner: 'testuser',
      category: 'Work',
      focusPriority: 5,
    }),

    /**
     * Shared calendar with read-only permissions
     */
    sharedReadOnly: ModelFactory.createCalendar({
      id: 'shared-calendar',
      displayName: 'Shared Calendar',
      color: '#00FF00',
      owner: 'otheruser',
      isShared: true,
      isReadOnly: true,
      permissions: {
        canRead: true,
        canWrite: false,
        canShare: false,
        canDelete: false,
      },
    }),

    /**
     * Shared calendar with read-write permissions
     */
    sharedReadWrite: ModelFactory.createCalendar({
      id: 'shared-editable',
      displayName: 'Shared Editable',
      color: '#0000FF',
      owner: 'otheruser',
      isShared: true,
      isReadOnly: false,
      permissions: {
        canRead: true,
        canWrite: true,
        canShare: false,
        canDelete: false,
      },
    }),
  },

  /**
   * Get all calendars as an array
   */
  getAllCalendars(): Calendar[] {
    return Object.values(this.calendars);
  },

  /**
   * Standard event collection
   */
  events: {
    /**
     * Simple one-hour event today
     */
    simple: ModelFactory.createEvent({
      id: 'simple-event',
      title: 'Simple Event',
      description: 'A simple one-hour event',
    }),

    /**
     * All-day event
     */
    allDay: ModelFactory.createEvent({
      id: 'all-day-event',
      title: 'All Day Event',
      description: 'An all-day event',
      isAllDay: true,
      start: new Date(new Date().setHours(0, 0, 0, 0)),
      end: new Date(new Date().setHours(23, 59, 59, 999)),
    }),

    /**
     * Recurring daily event
     */
    recurring: ModelFactory.createEvent({
      id: 'recurring-event',
      title: 'Recurring Event',
      description: 'A recurring event',
      recurrenceRule: ModelFactory.createRecurrenceRule({
        frequency: 'daily',
        interval: 1,
        count: 10,
      }),
    }),

    /**
     * Event with participants
     */
    withParticipants: ModelFactory.createEvent({
      id: 'event-with-participants',
      title: 'Meeting',
      description: 'A meeting with participants',
      participants: [
        ModelFactory.createParticipant({
          email: 'organizer@example.com',
          name: 'Organizer',
          status: 'accepted',
          role: 'required',
        }),
        ModelFactory.createParticipant({
          email: 'attendee1@example.com',
          name: 'Attendee 1',
          status: 'tentative',
          role: 'required',
        }),
        ModelFactory.createParticipant({
          email: 'attendee2@example.com',
          name: 'Attendee 2',
          status: 'needs-action',
          role: 'optional',
        }),
      ],
    }),

    /**
     * Event with ADHD-specific metadata
     */
    adhd: ModelFactory.createEvent({
      id: 'adhd-event',
      title: 'Focus Time',
      description: 'Dedicated focus time with ADHD metadata',
      adhdCategory: 'Focus Session',
      focusPriority: 8,
      energyLevel: 4,
      color: '#800080',
    }),
  },

  /**
   * Get all events as an array
   */
  getAllEvents(): Event[] {
    return Object.values(this.events);
  },

  /**
   * Various error responses
   */
  errors: {
    /**
     * Authentication error (401)
     */
    authError: {
      status: 401,
      message: 'Invalid credentials',
    },

    /**
     * Permission error (403)
     */
    permissionError: {
      status: 403,
      message: 'You do not have permission to access this resource',
    },

    /**
     * Not found error (404)
     */
    notFoundError: {
      status: 404,
      message: 'Resource not found',
    },

    /**
     * Conflict error (409)
     */
    conflictError: {
      status: 409,
      message: 'Resource already exists',
    },

    /**
     * Precondition failed error (412)
     */
    preconditionError: {
      status: 412,
      message: 'Precondition failed',
    },

    /**
     * Server error (500)
     */
    serverError: {
      status: 500,
      message: 'Internal server error',
    },
  },
};
