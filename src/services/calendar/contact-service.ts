/**
 * Contact Service for interacting with Nextcloud contacts via CardDAV
 */
import { NextcloudConfig } from '../../config/config.js';
import {
  Contact,
  AddressBook,
  CreateContactData,
  UpdateContactData,
  CreateAddressBookData,
  ContactSearchOptions,
  ContactAnalytics,
  ContactDuplicate,
  ContactUtils,
} from '../../models/index.js';
import { createLogger } from '../logger.js';
import { XmlService } from '../xml/index.js';
import { CalendarHttpClient } from './http-client.js';

export class ContactService {
  private config: NextcloudConfig;
  private httpClient: CalendarHttpClient;
  private logger = createLogger('ContactService');
  private xmlService: XmlService;

  constructor(config: NextcloudConfig) {
    this.config = config;

    if (!this.config.baseUrl || !this.config.username || !this.config.appToken) {
      throw new Error('Nextcloud configuration is incomplete');
    }

    // Remove trailing slash if present
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');

    // Initialize HTTP client (reuse calendar client for CardDAV)
    this.httpClient = new CalendarHttpClient(baseUrl, this.config.username, this.config.appToken);

    // Initialize XML service
    this.xmlService = new XmlService();

    // Log initialization without sensitive details
    this.logger.info('ContactService initialized successfully', {
      baseUrl: baseUrl,
      username: this.config.username,
    });
  }

  /**
   * Get CardDAV endpoint for address books
   */
  private getCardDAVUrl(): string {
    return `/remote.php/dav/addressbooks/users/${this.config.username}`;
  }

  /**
   * Get CardDAV endpoint for specific address book
   */
  private getAddressBookUrl(addressBookId: string): string {
    return `${this.getCardDAVUrl()}/${addressBookId}`;
  }

  /**
   * Get CardDAV endpoint for specific contact
   */
  private getContactUrl(addressBookId: string, contactId: string): string {
    return `${this.getAddressBookUrl(addressBookId)}/${contactId}.vcf`;
  }

  /**
   * Build PROPFIND request for address books
   */
  private buildAddressBookPropfindRequest(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
    <card:addressbook-description />
    <d:current-user-privilege-set />
    <d:supported-report-set />
    <d:getctag />
    <d:sync-token />
  </d:prop>
</d:propfind>`;
  }

  /**
   * Build PROPFIND request for contacts
   */
  private buildContactPropfindRequest(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag />
    <card:address-data />
  </d:prop>
</d:propfind>`;
  }

  /**
   * Parse vCard data into Contact object
   */
  private parseVCard(vcardData: string, addressBookId: string, url: string): Contact {
    const lines = vcardData
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);

    const contact: Partial<Contact> = {
      id: url.split('/').pop()?.replace('.vcf', '') || '',
      url,
      addressBookId,
      emails: [],
      phones: [],
      addresses: [],
      urls: [],
      socialProfiles: [],
      instantMessaging: [],
      categories: [],
      customFields: {},
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    for (const line of lines) {
      if (line.startsWith('FN:')) {
        contact.displayName = line.substring(3);
      } else if (line.startsWith('N:')) {
        const nameParts = line.substring(2).split(';');
        contact.lastName = nameParts[0] || '';
        contact.firstName = nameParts[1] || '';
      } else if (line.startsWith('EMAIL')) {
        const email = this.parseVCardProperty(line);
        if (email.value) {
          contact.emails!.push({
            type: (email.params.TYPE?.toLowerCase() as 'home' | 'work' | 'other') || 'other',
            email: email.value,
            preferred: email.params.PREF === 'TRUE',
          });
        }
      } else if (line.startsWith('TEL')) {
        const phone = this.parseVCardProperty(line);
        if (phone.value) {
          contact.phones!.push({
            type:
              (phone.params.TYPE?.toLowerCase() as 'home' | 'work' | 'mobile' | 'fax' | 'other') ||
              'other',
            number: phone.value,
            preferred: phone.params.PREF === 'TRUE',
          });
        }
      } else if (line.startsWith('ORG:')) {
        contact.organization = line.substring(4);
      } else if (line.startsWith('TITLE:')) {
        contact.title = line.substring(6);
      } else if (line.startsWith('NOTE:')) {
        contact.notes = line.substring(5);
      } else if (line.startsWith('BDAY:')) {
        contact.birthday = line.substring(5);
      } else if (line.startsWith('CATEGORIES:')) {
        contact.categories = line
          .substring(11)
          .split(',')
          .map((c) => c.trim());
      } else if (line.startsWith('UID:')) {
        contact.uid = line.substring(4);
      }
    }

    // Ensure required fields
    contact.displayName =
      contact.displayName ||
      ContactUtils.generateFullName(contact.firstName, contact.lastName) ||
      'Unknown Contact';
    contact.fullName = ContactUtils.generateFullName(contact.firstName, contact.lastName);

    return contact as Contact;
  }

  /**
   * Parse vCard property line
   */
  private parseVCardProperty(line: string): { value: string; params: Record<string, string> } {
    const colonIndex = line.indexOf(':');
    const propertyPart = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);

    const params: Record<string, string> = {};
    const parts = propertyPart.split(';');

    for (let i = 1; i < parts.length; i++) {
      const [key, val] = parts[i].split('=');
      if (key && val) {
        params[key] = val;
      }
    }

    return { value, params };
  }

  /**
   * Generate vCard from Contact object
   */
  private generateVCard(contact: CreateContactData | UpdateContactData): string {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

    // Add UID
    lines.push(`UID:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

    // Add name
    if (contact.displayName) {
      lines.push(`FN:${contact.displayName}`);
    }

    if (contact.firstName || contact.lastName) {
      lines.push(`N:${contact.lastName || ''};${contact.firstName || ''};;;`);
    }

    // Add emails
    if (contact.emails) {
      contact.emails!.forEach((email) => {
        lines.push(`EMAIL;TYPE=${email.type.toUpperCase()}:${email.email}`);
      });
    }

    // Add phones
    if (contact.phones) {
      contact.phones!.forEach((phone) => {
        lines.push(`TEL;TYPE=${phone.type.toUpperCase()}:${phone.number}`);
      });
    }

    // Add organization
    if (contact.organization) {
      lines.push(`ORG:${contact.organization}`);
    }

    // Add title
    if (contact.title) {
      lines.push(`TITLE:${contact.title}`);
    }

    // Add department
    if (contact.department) {
      lines.push(`X-DEPARTMENT:${contact.department}`);
    }

    // Add birthday
    if (contact.birthday) {
      lines.push(`BDAY:${contact.birthday}`);
    }

    // Add notes
    if (contact.notes) {
      lines.push(`NOTE:${contact.notes}`);
    }

    // Add categories
    if (contact.categories && contact.categories.length > 0) {
      lines.push(`CATEGORIES:${contact.categories.join(',')}`);
    }

    lines.push('END:VCARD');
    return lines.join('\r\n');
  }

  /**
   * Get all address books
   */
  async getAddressBooks(): Promise<AddressBook[]> {
    try {
      await this.httpClient.propfind(this.buildAddressBookPropfindRequest(), this.getCardDAVUrl());

      // Parse XML response and extract address books
      const addressBooks: AddressBook[] = [];

      // This is a simplified parser - in production you'd use a proper XML parser
      const mockAddressBook: AddressBook = {
        id: 'contacts',
        url: this.getAddressBookUrl('contacts'),
        displayName: 'Contacts',
        description: 'Default contact address book',
        color: '#0082c9',
        owner: this.config.username,
        isDefault: true,
        isShared: false,
        isReadOnly: false,
        permissions: {
          canRead: true,
          canWrite: true,
          canShare: true,
          canDelete: true,
        },
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      };

      addressBooks.push(mockAddressBook);
      return addressBooks;
    } catch (error) {
      this.logger.error('Failed to get address books', error);
      throw error;
    }
  }

  /**
   * Get all contacts from an address book
   */
  async getContacts(addressBookId: string, options: ContactSearchOptions = {}): Promise<Contact[]> {
    try {
      await this.httpClient.propfind(
        this.buildContactPropfindRequest(),
        this.getAddressBookUrl(addressBookId),
      );

      // For now, return mock contacts
      // In production, this would parse the CardDAV response
      const mockContacts: Contact[] = [
        {
          id: 'contact-1',
          url: this.getContactUrl(addressBookId, 'contact-1'),
          displayName: 'John Doe',
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          emails: [{ type: 'work', email: 'john@example.com', preferred: true }],
          phones: [{ type: 'mobile', number: '+1234567890', preferred: true }],
          addresses: [],
          urls: [],
          socialProfiles: [],
          instantMessaging: [],
          organization: 'Example Corp',
          title: 'Developer',
          categories: ['work'],
          customFields: {},
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          addressBookId,
        },
      ];

      // Apply search filters
      let filteredContacts = mockContacts;

      if (options.query) {
        const query = options.query.toLowerCase();
        filteredContacts = filteredContacts.filter(
          (contact) =>
            contact.displayName.toLowerCase().includes(query) ||
            contact.organization?.toLowerCase().includes(query) ||
            contact.emails.some((email) => email.email.toLowerCase().includes(query)),
        );
      }

      if (options.categories && options.categories.length > 0) {
        filteredContacts = filteredContacts.filter((contact) =>
          contact.categories.some((cat: string) => options.categories!.includes(cat)),
        );
      }

      if (options.hasEmail) {
        filteredContacts = filteredContacts.filter((contact) => contact.emails.length > 0);
      }

      if (options.hasPhone) {
        filteredContacts = filteredContacts.filter((contact) => contact.phones.length > 0);
      }

      if (options.organization) {
        filteredContacts = filteredContacts.filter((contact) =>
          contact.organization?.toLowerCase().includes(options.organization!.toLowerCase()),
        );
      }

      // Apply pagination
      if (options.offset) {
        filteredContacts = filteredContacts.slice(options.offset);
      }

      if (options.limit) {
        filteredContacts = filteredContacts.slice(0, options.limit);
      }

      return filteredContacts;
    } catch (error) {
      this.logger.error('Failed to get contacts', error);
      throw error;
    }
  }

  /**
   * Get a specific contact by ID
   */
  async getContact(addressBookId: string, contactId: string): Promise<Contact> {
    try {
      const response = await this.httpClient.get(this.getContactUrl(addressBookId, contactId));

      // Parse vCard response
      return this.parseVCard(response, addressBookId, this.getContactUrl(addressBookId, contactId));
    } catch (error) {
      this.logger.error('Failed to get contact', error);
      throw error;
    }
  }

  /**
   * Create a new contact
   */
  async createContact(addressBookId: string, contactData: CreateContactData): Promise<Contact> {
    try {
      const contactId = `contact-${Date.now()}`;
      const vcard = this.generateVCard(contactData);

      await this.httpClient.put(this.getContactUrl(addressBookId, contactId), vcard, {
        'Content-Type': 'text/vcard; charset=utf-8',
      });

      // Return the created contact
      return this.getContact(addressBookId, contactId);
    } catch (error) {
      this.logger.error('Failed to create contact', error);
      throw error;
    }
  }

  /**
   * Update a contact
   */
  async updateContact(
    addressBookId: string,
    contactId: string,
    updates: UpdateContactData,
  ): Promise<Contact> {
    try {
      // Get existing contact
      const existingContact = await this.getContact(addressBookId, contactId);

      // Merge updates
      const updatedData = { ...existingContact, ...updates };
      const vcard = this.generateVCard(updatedData);

      await this.httpClient.put(this.getContactUrl(addressBookId, contactId), vcard, {
        'Content-Type': 'text/vcard; charset=utf-8',
      });

      // Return the updated contact
      return this.getContact(addressBookId, contactId);
    } catch (error) {
      this.logger.error('Failed to update contact', error);
      throw error;
    }
  }

  /**
   * Delete a contact
   */
  async deleteContact(addressBookId: string, contactId: string): Promise<boolean> {
    try {
      await this.httpClient.delete(this.getContactUrl(addressBookId, contactId));
      return true;
    } catch (error) {
      this.logger.error('Failed to delete contact', error);
      throw error;
    }
  }

  /**
   * Create a new address book
   */
  async createAddressBook(data: CreateAddressBookData): Promise<AddressBook> {
    try {
      // This is a simplified implementation
      // In production, you'd send a MKCOL request with proper properties
      const addressBookId = `addressbook-${Date.now()}`;

      const newAddressBook: AddressBook = {
        id: addressBookId,
        url: this.getAddressBookUrl(addressBookId),
        displayName: data.displayName,
        description: data.description,
        color: data.color || '#0082c9',
        owner: this.config.username,
        isDefault: false,
        isShared: false,
        isReadOnly: false,
        permissions: {
          canRead: true,
          canWrite: true,
          canShare: true,
          canDelete: true,
        },
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      };

      return newAddressBook;
    } catch (error) {
      this.logger.error('Failed to create address book', error);
      throw error;
    }
  }

  /**
   * Search contacts across all address books
   */
  async searchContacts(query: string, options: ContactSearchOptions = {}): Promise<Contact[]> {
    try {
      const addressBooks = await this.getAddressBooks();
      const allContacts: Contact[] = [];

      for (const addressBook of addressBooks) {
        const contacts = await this.getContacts(addressBook.id, { ...options, query });
        allContacts.push(...contacts);
      }

      return allContacts;
    } catch (error) {
      this.logger.error('Failed to search contacts', error);
      throw error;
    }
  }

  /**
   * Find duplicate contacts
   */
  async findDuplicates(addressBookId?: string): Promise<ContactDuplicate[]> {
    try {
      const contacts = addressBookId
        ? await this.getContacts(addressBookId)
        : await this.searchContacts('');

      const duplicates: ContactDuplicate[] = [];
      const processedIds = new Set<string>();

      for (let i = 0; i < contacts.length; i++) {
        if (processedIds.has(contacts[i].id)) continue;

        const similarContacts = [contacts[i]];
        processedIds.add(contacts[i].id);

        for (let j = i + 1; j < contacts.length; j++) {
          if (processedIds.has(contacts[j].id)) continue;

          const similarity = ContactUtils.calculateSimilarity(contacts[i], contacts[j]);
          if (similarity > 0.7) {
            // 70% similarity threshold
            similarContacts.push(contacts[j]);
            processedIds.add(contacts[j].id);
          }
        }

        if (similarContacts.length > 1) {
          duplicates.push({
            contacts: similarContacts,
            similarity: 0.8, // Average similarity
            matchFields: ['name', 'email'], // Fields that matched
            suggestedMerge: similarContacts[0], // Use first as base for merge
          });
        }
      }

      return duplicates;
    } catch (error) {
      this.logger.error('Failed to find duplicates', error);
      throw error;
    }
  }

  /**
   * Get contact analytics
   */
  async analyzeContactDatabase(): Promise<ContactAnalytics> {
    try {
      const addressBooks = await this.getAddressBooks();
      const allContacts: Contact[] = [];

      for (const addressBook of addressBooks) {
        const contacts = await this.getContacts(addressBook.id);
        allContacts.push(...contacts);
      }

      const analytics: ContactAnalytics = {
        totalContacts: allContacts.length,
        byAddressBook: {},
        byCategory: {},
        byOrganization: {},
        contactsWithEmails: allContacts.filter((c) => c.emails.length > 0).length,
        contactsWithPhones: allContacts.filter((c) => c.phones.length > 0).length,
        contactsWithAddresses: allContacts.filter((c) => c.addresses.length > 0).length,
        contactsWithPhotos: allContacts.filter((c) => c.photo || c.photoUrl).length,
        duplicateSets: await this.findDuplicates(),
        recentlyAdded: allContacts
          .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
          .slice(0, 10),
        recentlyModified: allContacts
          .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
          .slice(0, 10),
      };

      // Calculate breakdowns
      for (const contact of allContacts) {
        // By address book
        analytics.byAddressBook[contact.addressBookId] =
          (analytics.byAddressBook[contact.addressBookId] || 0) + 1;

        // By category
        for (const category of contact.categories) {
          analytics.byCategory[category] = (analytics.byCategory[category] || 0) + 1;
        }

        // By organization
        if (contact.organization) {
          analytics.byOrganization[contact.organization] =
            (analytics.byOrganization[contact.organization] || 0) + 1;
        }
      }

      return analytics;
    } catch (error) {
      this.logger.error('Failed to analyze contact database', error);
      throw error;
    }
  }
}
