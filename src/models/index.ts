/**
 * Export all models and utilities
 */

// Export calendar types
export type {
  Calendar,
  CalendarPermissions,
  Event,
  Participant,
  RecurrenceRule,
  EventReminder,
  JSONObject,
} from './calendar.js';

// Export contact types
export type {
  Contact,
  ContactEmail,
  ContactPhone,
  ContactAddress,
  ContactUrl,
  ContactSocialProfile,
  ContactIM,
  AddressBook,
  AddressBookPermissions,
  CreateContactData,
  UpdateContactData,
  CreateAddressBookData,
  UpdateAddressBookData,
  ContactSearchOptions,
  ContactImportOptions,
  ContactExportOptions,
  BulkContactOperation,
  ContactDuplicate,
  ContactAnalytics,
} from './contact.js';

// Export calendar utilities
export {
  CalendarUtils,
  EventUtils,
  ParticipantUtils,
  RecurrenceUtils,
  ReminderUtils,
} from './calendar.js';

// Export contact utilities
export { ContactUtils, AddressBookUtils } from './contact.js';
