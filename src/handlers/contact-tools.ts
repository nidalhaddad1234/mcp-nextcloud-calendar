import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ContactService } from '../services/calendar/contact-service.js';
import { sanitizeError } from '../utils/error.js';

/**
 * Utility function to handle and sanitize errors for contact tools
 */
function handleContactToolError(operation: string, error: unknown) {
  console.error(`Error in ${operation} tool:`, error);

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

/**
 * Register contact-related tools with the MCP server
 * @param server The MCP server instance
 * @param contactService The contact service instance
 */
export function registerContactTools(server: McpServer, contactService: ContactService): void {
  if (!contactService) {
    return;
  }

  // List address books tool
  server.tool('listAddressBooks', {}, async () => {
    try {
      const addressBooks = await contactService.getAddressBooks();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, addressBooks }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleContactToolError('retrieve address books', error);
    }
  });

  // Create address book tool
  server.tool(
    'createAddressBook',
    {
      displayName: z.string(),
      description: z.string().optional(),
      color: z.string().optional(),
    },
    async ({ displayName, description, color }) => {
      try {
        const addressBook = await contactService.createAddressBook({
          displayName,
          description,
          color,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, addressBook }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('create address book', error);
      }
    },
  );

  // List contacts tool
  server.tool(
    'listContacts',
    {
      addressBookId: z.string(),
      query: z.string().optional(),
      categories: z.array(z.string()).optional(),
      hasEmail: z.boolean().optional(),
      hasPhone: z.boolean().optional(),
      organization: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async ({
      addressBookId,
      query,
      categories,
      hasEmail,
      hasPhone,
      organization,
      limit,
      offset,
    }) => {
      try {
        const contacts = await contactService.getContacts(addressBookId, {
          query,
          categories,
          hasEmail,
          hasPhone,
          organization,
          limit,
          offset,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, contacts }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('retrieve contacts', error);
      }
    },
  );

  // Get contact by ID tool
  server.tool(
    'getContact',
    {
      addressBookId: z.string(),
      contactId: z.string(),
    },
    async ({ addressBookId, contactId }) => {
      try {
        const contact = await contactService.getContact(addressBookId, contactId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, contact }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('retrieve contact', error);
      }
    },
  );

  // Create contact tool
  server.tool(
    'createContact',
    {
      addressBookId: z.string(),
      displayName: z.string(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      emails: z
        .array(
          z.object({
            type: z.enum(['home', 'work', 'other']),
            email: z.string().email(),
          }),
        )
        .optional(),
      phones: z
        .array(
          z.object({
            type: z.enum(['home', 'work', 'mobile', 'fax', 'other']),
            number: z.string(),
          }),
        )
        .optional(),
      addresses: z
        .array(
          z.object({
            type: z.enum(['home', 'work', 'other']),
            street: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            postalCode: z.string().optional(),
            country: z.string().optional(),
            fullAddress: z.string().optional(),
          }),
        )
        .optional(),
      organization: z.string().optional(),
      title: z.string().optional(),
      department: z.string().optional(),
      birthday: z.string().optional(),
      notes: z.string().optional(),
      categories: z.array(z.string()).optional(),
      photo: z.string().optional(),
      customFields: z.record(z.string()).optional(),
    },
    async ({ addressBookId, ...contactData }) => {
      try {
        const contact = await contactService.createContact(addressBookId, contactData);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, contact }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('create contact', error);
      }
    },
  );

  // Update contact tool
  server.tool(
    'updateContact',
    {
      addressBookId: z.string(),
      contactId: z.string(),
      displayName: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      emails: z
        .array(
          z.object({
            type: z.enum(['home', 'work', 'other']),
            email: z.string().email(),
          }),
        )
        .optional(),
      phones: z
        .array(
          z.object({
            type: z.enum(['home', 'work', 'mobile', 'fax', 'other']),
            number: z.string(),
          }),
        )
        .optional(),
      addresses: z
        .array(
          z.object({
            type: z.enum(['home', 'work', 'other']),
            street: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            postalCode: z.string().optional(),
            country: z.string().optional(),
            fullAddress: z.string().optional(),
          }),
        )
        .optional(),
      organization: z.string().optional(),
      title: z.string().optional(),
      department: z.string().optional(),
      birthday: z.string().optional(),
      notes: z.string().optional(),
      categories: z.array(z.string()).optional(),
      photo: z.string().optional(),
      customFields: z.record(z.string()).optional(),
    },
    async ({ addressBookId, contactId, ...updates }) => {
      try {
        const contact = await contactService.updateContact(addressBookId, contactId, updates);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, contact }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('update contact', error);
      }
    },
  );

  // Delete contact tool
  server.tool(
    'deleteContact',
    {
      addressBookId: z.string(),
      contactId: z.string(),
    },
    async ({ addressBookId, contactId }) => {
      try {
        const result = await contactService.deleteContact(addressBookId, contactId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: result }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('delete contact', error);
      }
    },
  );

  // Search contacts tool
  server.tool(
    'searchContacts',
    {
      query: z.string(),
      categories: z.array(z.string()).optional(),
      hasEmail: z.boolean().optional(),
      hasPhone: z.boolean().optional(),
      organization: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async ({ query, categories, hasEmail, hasPhone, organization, limit, offset }) => {
      try {
        const contacts = await contactService.searchContacts(query, {
          categories,
          hasEmail,
          hasPhone,
          organization,
          limit,
          offset,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, contacts }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('search contacts', error);
      }
    },
  );

  // Find duplicate contacts tool
  server.tool(
    'findDuplicateContacts',
    {
      addressBookId: z.string().optional(),
    },
    async ({ addressBookId }) => {
      try {
        const duplicates = await contactService.findDuplicates(addressBookId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, duplicates }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('find duplicate contacts', error);
      }
    },
  );

  // Analyze contact database tool
  server.tool('analyzeContactDatabase', {}, async () => {
    try {
      const analytics = await contactService.analyzeContactDatabase();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, analytics }, null, 2),
          },
        ],
      };
    } catch (error) {
      return handleContactToolError('analyze contact database', error);
    }
  });

  // Export contacts tool
  server.tool(
    'exportContacts',
    {
      format: z.enum(['vcard', 'csv', 'json']),
      addressBookId: z.string().optional(),
      contactIds: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
    },
    async ({ format, addressBookId, contactIds, categories }) => {
      try {
        let contacts;

        if (contactIds && contactIds.length > 0) {
          // Export specific contacts
          contacts = [];
          for (const contactId of contactIds) {
            if (addressBookId) {
              const contact = await contactService.getContact(addressBookId, contactId);
              contacts.push(contact);
            }
          }
        } else if (addressBookId) {
          // Export all contacts from address book
          contacts = await contactService.getContacts(addressBookId, { categories });
        } else {
          // Export all contacts
          contacts = await contactService.searchContacts('', { categories });
        }

        let exportData: string;
        let mimeType: string;

        switch (format) {
          case 'vcard':
            exportData = contacts
              .map((contact) => {
                // Generate vCard for each contact
                return `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.displayName}\nEND:VCARD`;
              })
              .join('\n');
            mimeType = 'text/vcard';
            break;

          case 'csv': {
            const csvHeaders = [
              'Name',
              'First Name',
              'Last Name',
              'Email',
              'Phone',
              'Organization',
              'Title',
            ];
            const csvRows = contacts.map((contact) => [
              contact.displayName || '',
              contact.firstName || '',
              contact.lastName || '',
              contact.emails[0]?.email || '',
              contact.phones[0]?.number || '',
              contact.organization || '',
              contact.title || '',
            ]);
            exportData = [csvHeaders, ...csvRows].map((row) => row.join(',')).join('\n');
            mimeType = 'text/csv';
            break;
          }

          case 'json':
            exportData = JSON.stringify(contacts, null, 2);
            mimeType = 'application/json';
            break;
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  format,
                  mimeType,
                  count: contacts.length,
                  data: exportData,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('export contacts', error);
      }
    },
  );

  // Import contacts tool
  server.tool(
    'importContacts',
    {
      addressBookId: z.string(),
      format: z.enum(['vcard', 'csv', 'json']),
      data: z.string(),
      overwriteExisting: z.boolean().optional(),
      createCategories: z.boolean().optional(),
    },
    async ({
      addressBookId,
      format,
      data,
      overwriteExisting: _overwriteExisting = false,
      createCategories: _createCategories = true,
    }) => {
      try {
        const results = {
          imported: 0,
          updated: 0,
          errors: [] as Array<{ error: string; data?: unknown; line?: number; contact?: unknown }>,
        };

        switch (format) {
          case 'vcard': {
            // Parse vCard data
            const vcards = data.split('BEGIN:VCARD').filter((vcard) => vcard.trim());
            for (const vcard of vcards) {
              try {
                // Simple vCard parsing
                const lines = vcard.split('\n');
                const fnLine = lines.find((line) => line.startsWith('FN:'));
                if (fnLine) {
                  const displayName = fnLine.substring(3);
                  await contactService.createContact(addressBookId, { displayName });
                  results.imported++;
                }
              } catch (error) {
                results.errors.push({ error: String(error), data: vcard });
              }
            }
            break;
          }

          case 'csv': {
            // Parse CSV data
            const csvLines = data.split('\n');
            const headers = csvLines[0].split(',');

            for (let i = 1; i < csvLines.length; i++) {
              try {
                const values = csvLines[i].split(',');
                const contactData: Record<string, unknown> = {};

                headers.forEach((header, index) => {
                  const value = values[index]?.trim();
                  if (value) {
                    switch (header.toLowerCase().trim()) {
                      case 'name':
                      case 'displayname':
                        contactData.displayName = value;
                        break;
                      case 'firstname':
                      case 'first name':
                        contactData.firstName = value;
                        break;
                      case 'lastname':
                      case 'last name':
                        contactData.lastName = value;
                        break;
                      case 'email':
                        contactData.emails = [{ type: 'work', email: value }];
                        break;
                      case 'phone':
                        contactData.phones = [{ type: 'work', number: value }];
                        break;
                      case 'organization':
                      case 'company':
                        contactData.organization = value;
                        break;
                    }
                  }
                });

                if (contactData.displayName || contactData.firstName || contactData.lastName) {
                  if (!contactData.displayName) {
                    contactData.displayName =
                      `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim();
                  }
                  await contactService.createContact(addressBookId, contactData);
                  results.imported++;
                }
              } catch (error) {
                results.errors.push({ error: String(error), line: i });
              }
            }
            break;
          }

          case 'json': {
            // Parse JSON data
            const jsonContacts = JSON.parse(data);
            const contactsArray = Array.isArray(jsonContacts) ? jsonContacts : [jsonContacts];

            for (const contactData of contactsArray) {
              try {
                await contactService.createContact(addressBookId, contactData);
                results.imported++;
              } catch (error) {
                results.errors.push({ error: String(error), contact: contactData });
              }
            }
            break;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, results }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('import contacts', error);
      }
    },
  );

  // Bulk update contacts tool
  server.tool(
    'bulkUpdateContacts',
    {
      addressBookId: z.string(),
      contactIds: z.array(z.string()),
      updates: z.object({
        categories: z.array(z.string()).optional(),
        organization: z.string().optional(),
        title: z.string().optional(),
        department: z.string().optional(),
        notes: z.string().optional(),
      }),
    },
    async ({ addressBookId, contactIds, updates }) => {
      try {
        const results = {
          updated: 0,
          errors: [] as Array<{ contactId: string; error: string }>,
        };

        for (const contactId of contactIds) {
          try {
            await contactService.updateContact(addressBookId, contactId, updates);
            results.updated++;
          } catch (error) {
            results.errors.push({ contactId, error: String(error) });
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, results }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('bulk update contacts', error);
      }
    },
  );

  // Bulk delete contacts tool
  server.tool(
    'bulkDeleteContacts',
    {
      addressBookId: z.string(),
      contactIds: z.array(z.string()),
    },
    async ({ addressBookId, contactIds }) => {
      try {
        const results = {
          deleted: 0,
          errors: [] as Array<{ contactId: string; error: string }>,
        };

        for (const contactId of contactIds) {
          try {
            await contactService.deleteContact(addressBookId, contactId);
            results.deleted++;
          } catch (error) {
            results.errors.push({ contactId, error: String(error) });
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, results }, null, 2),
            },
          ],
        };
      } catch (error) {
        return handleContactToolError('bulk delete contacts', error);
      }
    },
  );
}
