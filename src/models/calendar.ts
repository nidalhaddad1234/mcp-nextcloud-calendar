/**
 * Represents a Nextcloud Calendar
 */
export interface Calendar {
  /**
   * Unique identifier for the calendar
   */
  id: string;

  /**
   * Display name of the calendar
   */
  displayName: string;

  /**
   * Color of the calendar for visual distinction (in hex format)
   */
  color: string;

  /**
   * Calendar owner/user
   */
  owner: string;

  /**
   * Whether the calendar is the default calendar
   */
  isDefault: boolean;

  /**
   * Whether the calendar is shared with others
   */
  isShared: boolean;

  /**
   * Whether the calendar is read-only
   */
  isReadOnly: boolean;

  /**
   * Permissions for the current user
   */
  permissions: CalendarPermissions;

  /**
   * The URL to access the calendar
   */
  url: string;

  /**
   * Visual category or tag for ADHD-friendly organization
   */
  category?: string | null;

  /**
   * Priority level for ADHD focus management (1-10, 10 being highest)
   */
  focusPriority?: number | null;

  /**
   * Additional metadata for the calendar
   */
  metadata?: Record<string, unknown> | null;
}

/**
 * Defines access permissions for a calendar
 */
export interface CalendarPermissions {
  /**
   * Whether the user can read events
   */
  canRead: boolean;

  /**
   * Whether the user can create/add events
   */
  canWrite: boolean;

  /**
   * Whether the user can share the calendar
   */
  canShare: boolean;

  /**
   * Whether the user can delete the calendar
   */
  canDelete: boolean;
}

/**
 * Represents a calendar event
 */
export interface Event {
  /**
   * Unique identifier for the event
   */
  id: string;

  /**
   * ID of the calendar this event belongs to
   */
  calendarId: string;

  /**
   * Title/summary of the event
   */
  title: string;

  /**
   * Detailed description of the event
   */
  description?: string | null;

  /**
   * Start date and time of the event
   */
  start: Date;

  /**
   * End date and time of the event
   */
  end: Date;

  /**
   * Whether the event is an all-day event
   */
  isAllDay: boolean;

  /**
   * Location of the event
   */
  location?: string | null;

  /**
   * Organizer of the event
   */
  organizer?: string | null;

  /**
   * List of event participants/attendees
   */
  participants?: Participant[];

  /**
   * Recurrence rule for repeating events
   */
  recurrenceRule?: RecurrenceRule;

  /**
   * Status of the event (confirmed, tentative, cancelled)
   */
  status?: 'confirmed' | 'tentative' | 'cancelled';

  /**
   * Visibility of the event (public, private, confidential)
   */
  visibility?: 'public' | 'private' | 'confidential';

  /**
   * Whether the event is free or busy time
   */
  availability?: 'free' | 'busy';

  /**
   * Reminders associated with the event
   */
  reminders?: EventReminder[];

  /**
   * Color override for the event (hex format)
   */
  color?: string | null;

  /**
   * Tags or categories for the event
   */
  categories?: string[];

  /**
   * Visual category for ADHD-friendly organization
   */
  adhdCategory?: string;

  /**
   * Importance/priority level for ADHD focus (1-10, 10 being highest)
   */
  focusPriority?: number;

  /**
   * Estimated energy requirement (1-5, 5 being highest)
   */
  energyLevel?: number;

  /**
   * Tasks associated with this event
   */
  relatedTasks?: string[];

  /**
   * Creation time of the event
   */
  created: Date;

  /**
   * Last modification time of the event
   */
  lastModified: Date;

  /**
   * Additional metadata for the event
   */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a participant/attendee of an event
 */
export interface Participant {
  /**
   * Email address of the participant
   */
  email: string;

  /**
   * Display name of the participant
   */
  name?: string | null;

  /**
   * Participation status (accepted, declined, tentative, needs-action)
   */
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';

  /**
   * Role of the participant (required, optional)
   */
  role?: 'required' | 'optional';

  /**
   * Type of participant (individual, group, resource, room)
   */
  type?: 'individual' | 'group' | 'resource' | 'room';

  /**
   * Response comment from the participant
   */
  comment?: string | null;
}

/**
 * Defines a recurrence rule for repeating events
 */
export interface RecurrenceRule {
  /**
   * Frequency of the recurrence (daily, weekly, monthly, yearly)
   */
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';

  /**
   * Interval between occurrences
   */
  interval?: number;

  /**
   * End date of the recurrence
   */
  until?: Date;

  /**
   * Number of occurrences
   */
  count?: number;

  /**
   * Days of the week the event occurs on (for weekly recurrence)
   */
  byDay?: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[];

  /**
   * Days of the month the event occurs on (for monthly recurrence)
   */
  byMonthDay?: number[];

  /**
   * Months the event occurs on (for yearly recurrence)
   */
  byMonth?: number[];

  /**
   * Positions within the frequency period (e.g., 1st, 2nd, last)
   */
  bySetPos?: number[];

  /**
   * Dates to exclude from the recurrence
   */
  exDates?: Date[];
}

/**
 * Represents a reminder for an event
 */
export interface EventReminder {
  /**
   * Type of reminder (email, notification)
   */
  type: 'email' | 'notification';

  /**
   * Time before the event to trigger the reminder (in minutes)
   */
  minutesBefore: number;

  /**
   * Whether the reminder has been sent/triggered
   */
  isSent?: boolean;
}

/**
 * Type for JSON objects coming from or going to the API
 */
export type JSONObject = Record<string, unknown>;

/**
 * Type guards for validating enum values
 */

/**
 * Validates if a value is a valid participant status
 */
function isValidParticipantStatus(
  status: unknown,
): status is 'accepted' | 'declined' | 'tentative' | 'needs-action' {
  return (
    status === 'accepted' ||
    status === 'declined' ||
    status === 'tentative' ||
    status === 'needs-action'
  );
}

/**
 * Validates if a value is a valid event status
 */
function isValidEventStatus(status: unknown): status is 'confirmed' | 'tentative' | 'cancelled' {
  return status === 'confirmed' || status === 'tentative' || status === 'cancelled';
}

/**
 * Validates if a value is a valid visibility setting
 */
function isValidVisibility(
  visibility: unknown,
): visibility is 'public' | 'private' | 'confidential' {
  return visibility === 'public' || visibility === 'private' || visibility === 'confidential';
}

/**
 * Validates if a value is a valid availability setting
 */
function isValidAvailability(availability: unknown): availability is 'free' | 'busy' {
  return availability === 'free' || availability === 'busy';
}

/**
 * Validates if a value is a valid participant role
 */
function isValidParticipantRole(role: unknown): role is 'required' | 'optional' {
  return role === 'required' || role === 'optional';
}

/**
 * Validates if a value is a valid participant type
 */
function isValidParticipantType(
  type: unknown,
): type is 'individual' | 'group' | 'resource' | 'room' {
  return type === 'individual' || type === 'group' || type === 'resource' || type === 'room';
}

/**
 * Validates if a value is a valid reminder type
 */
function isValidReminderType(type: unknown): type is 'email' | 'notification' {
  return type === 'email' || type === 'notification';
}

/**
 * Validates if a value is a valid recurrence frequency
 */
function isValidFrequency(
  frequency: unknown,
): frequency is 'daily' | 'weekly' | 'monthly' | 'yearly' {
  return (
    frequency === 'daily' ||
    frequency === 'weekly' ||
    frequency === 'monthly' ||
    frequency === 'yearly'
  );
}

/**
 * Safely parses a date string, returning undefined if invalid
 */
function safelyParseDate(dateString: unknown): Date | undefined {
  if (!dateString) return undefined;

  try {
    if (dateString instanceof Date) return dateString;
    if (typeof dateString === 'string') {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) return undefined;
      return date;
    }
    return undefined;
  } catch {
    // Return undefined on any error
    return undefined;
  }
}

/**
 * Helper functions for serializing and deserializing calendar objects
 */
export const CalendarUtils = {
  /**
   * Converts a raw JSON object to a Calendar interface
   */
  toCalendar(data: JSONObject): Calendar {
    if (!data) {
      throw new Error('Invalid calendar data: data object is required');
    }

    if (!data.id) {
      throw new Error('Invalid calendar data: id is required');
    }

    // Extract required properties with validation
    const displayName = (data.displayName as string) || (data.display_name as string) || '';
    if (!displayName) {
      throw new Error('Invalid calendar data: displayName is required');
    }

    // Extract permissions with proper fallbacks
    const permissionsData = (data.permissions as JSONObject) || {};

    return {
      id: data.id as string,
      displayName,
      color: (data.color as string) || '#0082c9',
      owner: (data.owner as string) || '',
      isDefault: Boolean(data.isDefault || data.is_default),
      isShared: Boolean(data.isShared || data.is_shared),
      isReadOnly: Boolean(data.isReadOnly || data.is_read_only),
      permissions: {
        // We default canRead to true and others to false as a sensible security default:
        // Users should be able to read calendars by default but need explicit permission for other actions
        canRead: Boolean(permissionsData?.canRead || permissionsData?.can_read || true),
        canWrite: Boolean(permissionsData?.canWrite || permissionsData?.can_write || false),
        canShare: Boolean(permissionsData?.canShare || permissionsData?.can_share || false),
        canDelete: Boolean(permissionsData?.canDelete || permissionsData?.can_delete || false),
      },
      url: (data.url as string) || '',
      category: (data.category as string) || undefined,
      focusPriority: (data.focusPriority as number) || (data.focus_priority as number) || undefined,
      metadata: (data.metadata as Record<string, unknown> | null) || undefined,
    };
  },

  /**
   * Converts a Calendar object to a JSON object for API requests
   */
  fromCalendar(calendar: Calendar): JSONObject {
    return {
      id: calendar.id,
      display_name: calendar.displayName,
      color: calendar.color,
      owner: calendar.owner,
      is_default: calendar.isDefault,
      is_shared: calendar.isShared,
      is_read_only: calendar.isReadOnly,
      permissions: {
        can_read: calendar.permissions.canRead,
        can_write: calendar.permissions.canWrite,
        can_share: calendar.permissions.canShare,
        can_delete: calendar.permissions.canDelete,
      },
      url: calendar.url,
      category: calendar.category,
      focus_priority: calendar.focusPriority,
      metadata: calendar.metadata,
    };
  },
};

/**
 * Helper functions for serializing and deserializing event objects
 */
export const EventUtils = {
  /**
   * Converts a raw JSON object to an Event interface
   */
  toEvent(data: JSONObject): Event {
    if (!data) {
      throw new Error('Invalid event data: data object is required');
    }

    if (!data.id) {
      throw new Error('Invalid event data: id is required');
    }

    if (!data.start || !data.end) {
      throw new Error('Invalid event data: start and end dates are required');
    }

    // Safely parse dates
    const startDate = safelyParseDate(data.start);
    const endDate = safelyParseDate(data.end);
    const createdDate = safelyParseDate(data.created);
    const modifiedDate = safelyParseDate(data.lastModified) || safelyParseDate(data.last_modified);

    if (!startDate || !endDate) {
      throw new Error('Invalid event data: invalid start or end date format');
    }

    if (!createdDate || !modifiedDate) {
      throw new Error('Invalid event data: invalid created or lastModified date format');
    }

    const calendarId = (data.calendarId as string) || (data.calendar_id as string) || '';
    if (!calendarId) {
      throw new Error('Invalid event data: calendarId is required');
    }

    const title = (data.title as string) || (data.summary as string) || '';
    if (!title) {
      throw new Error('Invalid event data: title/summary is required');
    }

    return {
      id: data.id as string,
      calendarId,
      title,
      description: data.description as string | null | undefined,
      start: startDate,
      end: endDate,
      isAllDay: Boolean(data.isAllDay || data.is_all_day),
      location: data.location as string | null | undefined,
      organizer: data.organizer as string | null | undefined,
      participants: Array.isArray(data.participants)
        ? (data.participants as JSONObject[]).map((p) => ParticipantUtils.toParticipant(p))
        : undefined,
      recurrenceRule: data.recurrenceRule
        ? RecurrenceUtils.toRecurrenceRule(data.recurrenceRule as JSONObject)
        : data.recurrence_rule
          ? RecurrenceUtils.toRecurrenceRule(data.recurrence_rule as JSONObject)
          : undefined,
      status: isValidEventStatus(data.status) ? data.status : undefined,
      visibility: isValidVisibility(data.visibility) ? data.visibility : undefined,
      availability: isValidAvailability(data.availability) ? data.availability : undefined,
      reminders: Array.isArray(data.reminders)
        ? (data.reminders as JSONObject[]).map((r) => ReminderUtils.toReminder(r))
        : undefined,
      color: data.color as string | null | undefined,
      categories: Array.isArray(data.categories) ? (data.categories as string[]) : undefined,
      adhdCategory: (data.adhdCategory as string) || (data.adhd_category as string) || undefined,
      focusPriority: (data.focusPriority as number) || (data.focus_priority as number) || undefined,
      energyLevel: (data.energyLevel as number) || (data.energy_level as number) || undefined,
      relatedTasks: Array.isArray(data.relatedTasks)
        ? (data.relatedTasks as string[])
        : Array.isArray(data.related_tasks)
          ? (data.related_tasks as string[])
          : undefined,
      created: createdDate,
      lastModified: modifiedDate,
      metadata: data.metadata as Record<string, unknown> | null | undefined,
    };
  },

  /**
   * Converts an Event object to a JSON object for API requests
   */
  fromEvent(event: Event): JSONObject {
    return {
      id: event.id,
      calendar_id: event.calendarId,
      title: event.title,
      description: event.description,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      is_all_day: event.isAllDay,
      location: event.location,
      organizer: event.organizer,
      participants: event.participants
        ? event.participants.map((p) => ParticipantUtils.fromParticipant(p))
        : undefined,
      recurrence_rule: event.recurrenceRule
        ? RecurrenceUtils.fromRecurrenceRule(event.recurrenceRule)
        : undefined,
      status: event.status,
      visibility: event.visibility,
      availability: event.availability,
      reminders: event.reminders
        ? event.reminders.map((r) => ReminderUtils.fromReminder(r))
        : undefined,
      color: event.color,
      categories: event.categories,
      adhd_category: event.adhdCategory,
      focus_priority: event.focusPriority,
      energy_level: event.energyLevel,
      related_tasks: event.relatedTasks,
      created: event.created.toISOString(),
      last_modified: event.lastModified.toISOString(),
      metadata: event.metadata,
    };
  },
};

/**
 * Helper functions for serializing and deserializing participant objects
 */
export const ParticipantUtils = {
  /**
   * Converts a raw JSON object to a Participant interface
   */
  toParticipant(data: JSONObject): Participant {
    if (!data) {
      throw new Error('Invalid participant data: data object is required');
    }

    if (!data.email) {
      throw new Error('Invalid participant data: email is required');
    }

    return {
      email: (data.email as string) || '',
      name: data.name as string | null | undefined,
      status: isValidParticipantStatus(data.status) ? data.status : 'needs-action',
      role: isValidParticipantRole(data.role) ? data.role : undefined,
      type: isValidParticipantType(data.type) ? data.type : undefined,
      comment: data.comment as string | null | undefined,
    };
  },

  /**
   * Converts a Participant object to a JSON object for API requests
   */
  fromParticipant(participant: Participant): JSONObject {
    return {
      email: participant.email,
      name: participant.name,
      status: participant.status,
      role: participant.role,
      type: participant.type,
      comment: participant.comment,
    };
  },
};

/**
 * Helper functions for serializing and deserializing recurrence rule objects
 */
export const RecurrenceUtils = {
  /**
   * Converts a raw JSON object to a RecurrenceRule interface
   */
  toRecurrenceRule(data: JSONObject): RecurrenceRule {
    if (!data) {
      throw new Error('Invalid recurrence rule data: data object is required');
    }

    if (!data.frequency && !isValidFrequency(data.frequency)) {
      throw new Error('Invalid recurrence rule data: valid frequency is required');
    }

    // Safely parse the until date if present
    let untilDate: Date | undefined = undefined;
    if (data.until) {
      untilDate = safelyParseDate(data.until);
      if (data.until && !untilDate) {
        throw new Error('Invalid recurrence rule data: invalid until date format');
      }
    }

    // Safely process exDates if present
    let exDates: Date[] | undefined = undefined;
    if (Array.isArray(data.exDates) || Array.isArray(data.ex_dates)) {
      const exDateStrings = (data.exDates || data.ex_dates) as string[];
      exDates = [];

      for (const dateStr of exDateStrings) {
        const parsedDate = safelyParseDate(dateStr);
        if (parsedDate) {
          exDates.push(parsedDate);
        }
      }
    }

    return {
      frequency: isValidFrequency(data.frequency) ? data.frequency : 'daily',
      interval: data.interval as number | undefined,
      until: untilDate,
      count: data.count as number | undefined,
      byDay: Array.isArray(data.byDay || data.by_day)
        ? ((data.byDay || data.by_day) as ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[])
        : undefined,
      byMonthDay: Array.isArray(data.byMonthDay || data.by_month_day)
        ? ((data.byMonthDay || data.by_month_day) as number[])
        : undefined,
      byMonth: Array.isArray(data.byMonth || data.by_month)
        ? ((data.byMonth || data.by_month) as number[])
        : undefined,
      bySetPos: Array.isArray(data.bySetPos || data.by_set_pos)
        ? ((data.bySetPos || data.by_set_pos) as number[])
        : undefined,
      exDates,
    };
  },

  /**
   * Converts a RecurrenceRule object to a JSON object for API requests
   */
  fromRecurrenceRule(rule: RecurrenceRule): JSONObject {
    return {
      frequency: rule.frequency,
      interval: rule.interval,
      until: rule.until?.toISOString(),
      count: rule.count,
      by_day: rule.byDay,
      by_month_day: rule.byMonthDay,
      by_month: rule.byMonth,
      by_set_pos: rule.bySetPos,
      ex_dates: rule.exDates?.map((d) => d.toISOString()),
    };
  },
};

/**
 * Helper functions for serializing and deserializing reminder objects
 */
export const ReminderUtils = {
  /**
   * Converts a raw JSON object to an EventReminder interface
   */
  toReminder(data: JSONObject): EventReminder {
    if (!data) {
      throw new Error('Invalid reminder data: data object is required');
    }

    // Convert minutesBefore to a number and validate it
    const minutesBefore = Number(data.minutesBefore) || Number(data.minutes_before) || 10;
    if (isNaN(minutesBefore) || minutesBefore < 0) {
      throw new Error('Invalid reminder data: minutesBefore must be a positive number');
    }

    return {
      type: isValidReminderType(data.type) ? data.type : 'notification',
      minutesBefore,
      isSent: Boolean(data.isSent || data.is_sent),
    };
  },

  /**
   * Converts an EventReminder object to a JSON object for API requests
   */
  fromReminder(reminder: EventReminder): JSONObject {
    return {
      type: reminder.type,
      minutes_before: reminder.minutesBefore,
      is_sent: reminder.isSent,
    };
  },
};
