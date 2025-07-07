/**
 * Contact and Address Book model definitions for Nextcloud integration
 */

export interface Contact {
  id: string;
  url: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  nickName?: string;

  // Contact information
  emails: ContactEmail[];
  phones: ContactPhone[];
  addresses: ContactAddress[];
  urls: ContactUrl[];

  // Organization
  organization?: string;
  title?: string;
  department?: string;

  // Personal details
  birthday?: string;
  anniversary?: string;
  categories: string[];
  notes?: string;

  // Social/Messaging
  socialProfiles: ContactSocialProfile[];
  instantMessaging: ContactIM[];

  // Metadata
  photo?: string; // Base64 or URL
  photoUrl?: string;
  created: string;
  lastModified: string;
  addressBookId: string;

  // Custom fields
  customFields: Record<string, string>;

  // vCard related
  uid?: string;
  version?: string;
}

export interface ContactEmail {
  type: 'home' | 'work' | 'other';
  email: string;
  preferred?: boolean;
}

export interface ContactPhone {
  type: 'home' | 'work' | 'mobile' | 'fax' | 'other';
  number: string;
  preferred?: boolean;
}

export interface ContactAddress {
  type: 'home' | 'work' | 'other';
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  fullAddress?: string;
  preferred?: boolean;
}

export interface ContactUrl {
  type: 'home' | 'work' | 'blog' | 'other';
  url: string;
}

export interface ContactSocialProfile {
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'github' | 'other';
  username: string;
  url?: string;
}

export interface ContactIM {
  protocol: 'jabber' | 'telegram' | 'whatsapp' | 'signal' | 'discord' | 'other';
  handle: string;
}

export interface AddressBook {
  id: string;
  url: string;
  displayName: string;
  description?: string;
  color?: string;
  owner: string;
  isDefault: boolean;
  isShared: boolean;
  isReadOnly: boolean;
  permissions: AddressBookPermissions;
  syncToken?: string;
  created: string;
  lastModified: string;
}

export interface AddressBookPermissions {
  canRead: boolean;
  canWrite: boolean;
  canShare: boolean;
  canDelete: boolean;
}

// Contact creation/update interfaces
export interface CreateContactData {
  displayName: string;
  firstName?: string;
  lastName?: string;
  emails?: Omit<ContactEmail, 'preferred'>[];
  phones?: Omit<ContactPhone, 'preferred'>[];
  addresses?: Omit<ContactAddress, 'preferred'>[];
  organization?: string;
  title?: string;
  department?: string;
  birthday?: string;
  notes?: string;
  categories?: string[];
  photo?: string;
  customFields?: Record<string, string>;
}

export type UpdateContactData = Partial<CreateContactData>;

export interface CreateAddressBookData {
  displayName: string;
  description?: string;
  color?: string;
}

export type UpdateAddressBookData = Partial<CreateAddressBookData>;

// Search and filter interfaces
export interface ContactSearchOptions {
  query?: string;
  categories?: string[];
  hasEmail?: boolean;
  hasPhone?: boolean;
  organization?: string;
  limit?: number;
  offset?: number;
}

export interface ContactImportOptions {
  format: 'vcard' | 'csv' | 'json';
  data: string;
  addressBookId: string;
  overwriteExisting?: boolean;
  createCategories?: boolean;
}

export interface ContactExportOptions {
  format: 'vcard' | 'csv' | 'json';
  contactIds?: string[];
  addressBookId?: string;
  categories?: string[];
}

export interface BulkContactOperation {
  contactIds: string[];
  operation: 'update' | 'delete' | 'addCategory' | 'removeCategory';
  data?: UpdateContactData | { category: string };
}

export interface ContactDuplicate {
  contacts: Contact[];
  similarity: number;
  matchFields: string[];
  suggestedMerge: Contact;
}

export interface ContactAnalytics {
  totalContacts: number;
  byAddressBook: Record<string, number>;
  byCategory: Record<string, number>;
  byOrganization: Record<string, number>;
  contactsWithEmails: number;
  contactsWithPhones: number;
  contactsWithAddresses: number;
  contactsWithPhotos: number;
  duplicateSets: ContactDuplicate[];
  recentlyAdded: Contact[];
  recentlyModified: Contact[];
}

/**
 * Contact utility functions
 */
export class ContactUtils {
  /**
   * Generate a full name from first and last name
   */
  static generateFullName(firstName?: string, lastName?: string): string {
    const parts = [firstName, lastName].filter(Boolean);
    return parts.join(' ');
  }

  /**
   * Get primary email for a contact
   */
  static getPrimaryEmail(contact: Contact): string | undefined {
    const preferred = contact.emails.find((email) => email.preferred);
    return preferred?.email || contact.emails[0]?.email;
  }

  /**
   * Get primary phone for a contact
   */
  static getPrimaryPhone(contact: Contact): string | undefined {
    const preferred = contact.phones.find((phone) => phone.preferred);
    return preferred?.number || contact.phones[0]?.number;
  }

  /**
   * Format contact for display
   */
  static formatContactSummary(contact: Contact): string {
    const email = ContactUtils.getPrimaryEmail(contact);
    const phone = ContactUtils.getPrimaryPhone(contact);
    const org = contact.organization;

    let summary = contact.displayName;
    if (org) summary += ` (${org})`;
    if (email) summary += ` - ${email}`;
    if (phone) summary += ` - ${phone}`;

    return summary;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Normalize phone number
   */
  static normalizePhone(phone: string): string {
    return phone.replace(/[\s\-()]/g, '');
  }

  /**
   * Calculate contact similarity for duplicate detection
   */
  static calculateSimilarity(contact1: Contact, contact2: Contact): number {
    let score = 0;
    let maxScore = 0;

    // Name similarity
    maxScore += 3;
    if (contact1.displayName.toLowerCase() === contact2.displayName.toLowerCase()) score += 3;
    else if (
      contact1.displayName.toLowerCase().includes(contact2.displayName.toLowerCase()) ||
      contact2.displayName.toLowerCase().includes(contact1.displayName.toLowerCase())
    )
      score += 2;

    // Email similarity
    maxScore += 2;
    const emails1 = contact1.emails.map((e) => e.email.toLowerCase());
    const emails2 = contact2.emails.map((e) => e.email.toLowerCase());
    const emailMatches = emails1.filter((e) => emails2.includes(e));
    if (emailMatches.length > 0) score += 2;

    // Phone similarity
    maxScore += 2;
    const phones1 = contact1.phones.map((p) => ContactUtils.normalizePhone(p.number));
    const phones2 = contact2.phones.map((p) => ContactUtils.normalizePhone(p.number));
    const phoneMatches = phones1.filter((p) => phones2.includes(p));
    if (phoneMatches.length > 0) score += 2;

    // Organization similarity
    maxScore += 1;
    if (
      contact1.organization &&
      contact2.organization &&
      contact1.organization.toLowerCase() === contact2.organization.toLowerCase()
    )
      score += 1;

    return maxScore > 0 ? score / maxScore : 0;
  }
}

/**
 * AddressBook utility functions
 */
export class AddressBookUtils {
  /**
   * Check if address book is writable
   */
  static isWritable(addressBook: AddressBook): boolean {
    return addressBook.permissions.canWrite && !addressBook.isReadOnly;
  }

  /**
   * Check if address book can be shared
   */
  static isShareable(addressBook: AddressBook): boolean {
    return addressBook.permissions.canShare;
  }

  /**
   * Generate default color for address book
   */
  static getDefaultColor(): string {
    const colors = ['#0082c9', '#e74c3c', '#f39c12', '#27ae60', '#9b59b6', '#34495e'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
