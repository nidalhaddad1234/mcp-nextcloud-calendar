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
  category?: string;

  /**
   * Priority level for ADHD focus management (1-10, 10 being highest)
   */
  focusPriority?: number;

  /**
   * Additional metadata for the calendar
   */
  metadata?: Record<string, unknown>;
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
  description?: string;

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
  location?: string;

  /**
   * Organizer of the event
   */
  organizer?: string;

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
  color?: string;

  /**
   * Tags or categories for the event
   */
  categories?: string[];

  /**
   * Visual category for ADHD-friendly organization
   */
  adhd_category?: string;

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
  name?: string;

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
  comment?: string;
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
 * Helper functions for serializing and deserializing calendar objects
 */
export const CalendarUtils = {
  /**
   * Converts a raw JSON object to a Calendar interface
   */
  toCalendar(data: JSONObject): Calendar {
    return {
      id: data.id as string,
      displayName: (data.displayName as string) || (data.display_name as string) || '',
      color: (data.color as string) || '#0082c9',
      owner: (data.owner as string) || '',
      isDefault: Boolean(data.isDefault || data.is_default),
      isShared: Boolean(data.isShared || data.is_shared),
      isReadOnly: Boolean(data.isReadOnly || data.is_read_only),
      permissions: {
        canRead: Boolean(
          (data.permissions as JSONObject)?.canRead ||
            (data.permissions as JSONObject)?.can_read ||
            true,
        ),
        canWrite: Boolean(
          (data.permissions as JSONObject)?.canWrite ||
            (data.permissions as JSONObject)?.can_write ||
            false,
        ),
        canShare: Boolean(
          (data.permissions as JSONObject)?.canShare ||
            (data.permissions as JSONObject)?.can_share ||
            false,
        ),
        canDelete: Boolean(
          (data.permissions as JSONObject)?.canDelete ||
            (data.permissions as JSONObject)?.can_delete ||
            false,
        ),
      },
      url: (data.url as string) || '',
      category: (data.category as string) || undefined,
      focusPriority: (data.focusPriority as number) || (data.focus_priority as number) || undefined,
      metadata: (data.metadata as Record<string, unknown>) || undefined,
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
    return {
      id: data.id as string,
      calendarId: (data.calendarId as string) || (data.calendar_id as string) || '',
      title: (data.title as string) || (data.summary as string) || '',
      description: data.description as string | undefined,
      start: data.start instanceof Date ? data.start : new Date(data.start as string),
      end: data.end instanceof Date ? data.end : new Date(data.end as string),
      isAllDay: Boolean(data.isAllDay || data.is_all_day),
      location: data.location as string | undefined,
      organizer: data.organizer as string | undefined,
      participants: Array.isArray(data.participants)
        ? (data.participants as JSONObject[]).map((p) => ParticipantUtils.toParticipant(p))
        : undefined,
      recurrenceRule: data.recurrenceRule
        ? RecurrenceUtils.toRecurrenceRule(data.recurrenceRule as JSONObject)
        : data.recurrence_rule
          ? RecurrenceUtils.toRecurrenceRule(data.recurrence_rule as JSONObject)
          : undefined,
      status: data.status as 'confirmed' | 'tentative' | 'cancelled' | undefined,
      visibility: data.visibility as 'public' | 'private' | 'confidential' | undefined,
      availability: data.availability as 'free' | 'busy' | undefined,
      reminders: Array.isArray(data.reminders)
        ? (data.reminders as JSONObject[]).map((r) => ReminderUtils.toReminder(r))
        : undefined,
      color: data.color as string | undefined,
      categories: Array.isArray(data.categories) ? (data.categories as string[]) : undefined,
      adhd_category: data.adhd_category as string | undefined,
      focusPriority: (data.focusPriority as number) || (data.focus_priority as number) || undefined,
      energyLevel: (data.energyLevel as number) || (data.energy_level as number) || undefined,
      relatedTasks: Array.isArray(data.relatedTasks)
        ? (data.relatedTasks as string[])
        : Array.isArray(data.related_tasks)
          ? (data.related_tasks as string[])
          : undefined,
      created: data.created instanceof Date ? data.created : new Date(data.created as string),
      lastModified:
        data.lastModified instanceof Date
          ? data.lastModified
          : new Date((data.lastModified as string) || (data.last_modified as string)),
      metadata: data.metadata as Record<string, unknown> | undefined,
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
      adhd_category: event.adhd_category,
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
    return {
      email: (data.email as string) || '',
      name: data.name as string | undefined,
      status:
        (data.status as 'accepted' | 'declined' | 'tentative' | 'needs-action') || 'needs-action',
      role: data.role as 'required' | 'optional' | undefined,
      type: data.type as 'individual' | 'group' | 'resource' | 'room' | undefined,
      comment: data.comment as string | undefined,
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
    return {
      frequency: (data.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'daily',
      interval: data.interval as number | undefined,
      until: data.until ? new Date(data.until as string) : undefined,
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
      exDates: Array.isArray(data.exDates || data.ex_dates)
        ? ((data.exDates || data.ex_dates) as string[]).map((d) => new Date(d))
        : undefined,
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
    return {
      type: (data.type as 'email' | 'notification') || 'notification',
      minutesBefore: (data.minutesBefore as number) || (data.minutes_before as number) || 10,
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
