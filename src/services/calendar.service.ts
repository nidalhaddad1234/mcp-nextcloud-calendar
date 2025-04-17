import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { NextcloudConfig } from '../config/config.js';
import { Calendar, CalendarUtils } from '../models/index.js';

export class CalendarService {
  private config: NextcloudConfig;
  private authHeader: string;
  private baseUrl: string;
  private caldavUrl: string;

  constructor(config: NextcloudConfig) {
    this.config = config;
    
    if (!this.config.baseUrl || !this.config.username || !this.config.appToken) {
      throw new Error('Nextcloud configuration is incomplete');
    }
    
    // Remove trailing slash if present
    this.baseUrl = this.config.baseUrl.replace(/\/$/, '');
    
    // Create the CalDAV URL for the user
    this.caldavUrl = `${this.baseUrl}/remote.php/dav/calendars/${this.config.username}/`;
    
    console.log('Initialized CalendarService with:');
    console.log('  Base URL:', this.baseUrl);
    console.log('  CalDAV URL:', this.caldavUrl);
    console.log('  Username:', this.config.username);
    
    // Create Basic Auth header
    // Use global Buffer (available in Node.js)
    // eslint-disable-next-line no-undef
    const auth = Buffer.from(`${config.username}:${config.appToken}`).toString('base64');
    this.authHeader = `Basic ${auth}`;
  }

  /**
   * Get a list of all calendars for the user
   * @returns Promise<Calendar[]> List of calendars
   */
  async getCalendars(): Promise<Calendar[]> {
    try {
      // Make request to Nextcloud CalDAV endpoint with PROPFIND
      const response = await axios({
        method: 'PROPFIND',
        url: this.caldavUrl,
        headers: {
          'Authorization': this.authHeader,
          'Depth': '1',
          'Content-Type': 'application/xml; charset=utf-8',
        },
        data: `<?xml version="1.0" encoding="utf-8" ?>
              <d:propfind xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav"
                  xmlns:cs="http://calendarserver.org/ns/" xmlns:oc="http://owncloud.org/ns">
                <d:prop>
                  <d:resourcetype />
                  <d:displayname />
                  <cal:supported-calendar-component-set />
                  <cs:getctag />
                  <oc:calendar-enabled />
                  <d:sync-token />
                  <oc:owner-principal />
                  <d:current-user-privilege-set />
                  <oc:invite />
                  <oc:calendar-order />
                  <d:color />
                </d:prop>
              </d:propfind>`
      });
      
      // Parse XML response
      const xmlData = await parseStringPromise(response.data, { explicitArray: false });
      
      // Extract calendar information
      const calendars: Calendar[] = [];
      
      if (xmlData && xmlData['d:multistatus'] && xmlData['d:multistatus']['d:response']) {
        const responses = Array.isArray(xmlData['d:multistatus']['d:response']) 
          ? xmlData['d:multistatus']['d:response'] 
          : [xmlData['d:multistatus']['d:response']];
          
        for (const item of responses) {
          // Skip the parent directory response
          if (item['d:href'] === this.caldavUrl.substring(this.baseUrl.length) || 
              !item['d:propstat']) {
            continue;
          }
          
          // Find successful propstat
          const propstat = Array.isArray(item['d:propstat'])
            ? item['d:propstat'].find((ps: { 'd:status'?: string }) => ps['d:status'] === 'HTTP/1.1 200 OK')
            : item['d:propstat'];
            
          if (propstat && propstat['d:prop']) {
            const prop = propstat['d:prop'];
            
            // Only process items that are calendars
            if (prop['d:resourcetype'] && 
                (prop['d:resourcetype']['cal:calendar'] || 
                 (typeof prop['d:resourcetype'] === 'object' && 
                  Object.keys(prop['d:resourcetype']).some(key => key.includes('calendar'))))) {
              
              const calendarId = item['d:href'].split('/').filter(Boolean).pop();
              
              // For testing, always consider calendars enabled since Nextcloud doesn't always expose this property
              // Skip disabled calendars if the property exists
              if (prop['oc:calendar-enabled'] === '0') {
                continue;
              }
              
              // Extract permission information
              const privileges = this.parsePrivilegeSet(prop['d:current-user-privilege-set']);
              
              // Determine if shared
              const isShared = !!prop['oc:invite'];
              
              // Extract owner information
              let owner = this.config.username;
              if (prop['oc:owner-principal']) {
                const ownerMatch = prop['oc:owner-principal'].match(/principal:principals\/users\/([^/]+)/);
                if (ownerMatch && ownerMatch[1]) {
                  owner = ownerMatch[1];
                }
              }
              
              // Extract color (strip quotes if present)
              let color = prop['d:color'] || prop['x1:calendar-color'] || '#0082c9';
              if (typeof color === 'string' && color.startsWith('"') && color.endsWith('"')) {
                color = color.substring(1, color.length - 1);
              }
              
              // Create calendar object
              const calendar = CalendarUtils.toCalendar({
                id: calendarId,
                displayName: prop['d:displayname'] || calendarId,
                color: color,
                owner: owner,
                isDefault: calendarId === 'personal', // Personal is usually the default calendar
                isShared: isShared,
                isReadOnly: !privileges.canWrite,
                permissions: {
                  canRead: privileges.canRead,
                  canWrite: privileges.canWrite,
                  canShare: privileges.canShare,
                  canDelete: privileges.canDelete
                },
                url: `${this.baseUrl}${item['d:href']}`,
                // For ADHD-friendly organization
                category: null,
                focusPriority: null,
                metadata: null
              });
              
              calendars.push(calendar);
            }
          }
        }
      }
      
      return calendars;
    } catch (error) {
      console.error('Error fetching calendars:', error);
      throw new Error(`Failed to fetch calendars: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new calendar
   * @param newCalendar Calendar object with properties for the new calendar
   * @returns Promise<Calendar> The created calendar with server-assigned properties
   * 
   * TODO: Implementation needed (GitHub issue #4) with the following:
   * - Create calendar using MKCALENDAR WebDAV method
   * - Set calendar properties like displayName, color
   * - Support ADHD-friendly organization features
   * - Handle authorization errors
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createCalendar(newCalendar: Omit<Calendar, 'id' | 'url'>): Promise<Calendar> {
    throw new Error('Not implemented - see GitHub issue #4');
  }

  /**
   * Update an existing calendar
   * @param calendarId ID of the calendar to update
   * @param updates Calendar object with updated properties
   * @returns Promise<Calendar> The updated calendar
   * 
   * TODO: Implementation needed (GitHub issue #4) with the following:
   * - Update calendar properties using PROPPATCH WebDAV method
   * - Support updating displayName, color, and ADHD organization properties
   * - Handle missing calendar and permission errors
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateCalendar(calendarId: string, updates: Partial<Calendar>): Promise<Calendar> {
    throw new Error('Not implemented - see GitHub issue #4');
  }

  /**
   * Delete a calendar
   * @param calendarId ID of the calendar to delete
   * @returns Promise<boolean> True if calendar was deleted successfully
   * 
   * TODO: Implementation needed (GitHub issue #4) with the following:
   * - Delete calendar using DELETE WebDAV method
   * - Proper error handling for permission issues
   * - Check if calendar exists before attempting deletion
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteCalendar(calendarId: string): Promise<boolean> {
    throw new Error('Not implemented - see GitHub issue #4');
  }

  /**
   * Helper function to parse WebDAV privilege set into permission object
   */
  private parsePrivilegeSet(privilegeSet: Record<string, unknown> | null): { 
    canRead: boolean; 
    canWrite: boolean; 
    canShare: boolean; 
    canDelete: boolean; 
  } {
    const permissions = {
      canRead: false,
      canWrite: false,
      canShare: false,
      canDelete: false
    };
    
    // If no privilege set provided, default to read-only access
    if (!privilegeSet) {
      permissions.canRead = true;
      return permissions;
    }
    
    // If no privileges found, assume read access
    if (!privilegeSet['d:privilege']) {
      permissions.canRead = true;
      return permissions;
    }
    
    const privileges = Array.isArray(privilegeSet['d:privilege']) 
      ? privilegeSet['d:privilege'] 
      : [privilegeSet['d:privilege']];
      
    // For Nextcloud, assume we have read access if we can see the calendar at all
    permissions.canRead = true;
    
    for (const privilege of privileges) {
      // Write permissions
      if (privilege['d:write'] || 
          privilege['d:write-content'] || 
          privilege['d:write-properties']) {
        permissions.canWrite = true;
      }
      
      // Share permission (Nextcloud specific)
      if (privilege['d:share'] || privilege['oc:share']) {
        permissions.canShare = true;
      }
      
      // Delete permission
      if (privilege['d:unbind'] || privilege['d:write']) {
        permissions.canDelete = true;
      }
    }
    
    return permissions;
  }
}