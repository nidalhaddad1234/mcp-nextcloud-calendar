import { CalendarService } from '../services/calendar/calendar-service.js';
import { CalendarHttpClient } from '../services/calendar/http-client.js';
import * as XmlUtils from '../services/calendar/xml-utils.js';

// Manually mock the dependencies since we're using ES modules
jest.fn();

// Mock HTTP client
CalendarHttpClient.prototype.propfind = jest.fn();
CalendarHttpClient.prototype.mkcalendar = jest.fn();
CalendarHttpClient.prototype.proppatch = jest.fn();
CalendarHttpClient.prototype.deleteCalendar = jest.fn();
CalendarHttpClient.prototype.getCalDavUrl = jest.fn();
CalendarHttpClient.prototype.getBaseUrl = jest.fn();

// Mock XML utils
XmlUtils.parseXmlResponse = jest.fn();
XmlUtils.getMultistatus = jest.fn();
XmlUtils.getResponses = jest.fn();

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock the createLogger function
jest.mock('../services/logger.js', () => ({
  createLogger: jest.fn().mockReturnValue(mockLogger)
}));

describe('CalendarService', () => {
  // Config for tests
  const mockConfig = {
    baseUrl: 'https://nextcloud.example.com',
    username: 'testuser',
    appToken: 'test-token'
  };
  
  // Sample calendar data
  const sampleCalendars = [
    {
      id: 'personal',
      displayName: 'Personal',
      color: '#0082c9',
      owner: 'testuser',
      isDefault: true,
      isShared: false,
      isReadOnly: false,
      permissions: { canRead: true, canWrite: true, canShare: true, canDelete: true },
      url: 'https://nextcloud.example.com/remote.php/dav/calendars/testuser/personal/',
      category: null,
      focusPriority: null,
      metadata: null
    },
    {
      id: 'work',
      displayName: 'Work',
      color: '#FF0000',
      owner: 'testuser',
      isDefault: false,
      isShared: false,
      isReadOnly: false,
      permissions: { canRead: true, canWrite: true, canShare: true, canDelete: true },
      url: 'https://nextcloud.example.com/remote.php/dav/calendars/testuser/work/',
      category: 'Work',
      focusPriority: 5,
      metadata: null
    }
  ];
  
  // Setup and teardown
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should throw error for incomplete config', () => {
      expect(() => new CalendarService({ baseUrl: '', username: '', appToken: '' }))
        .toThrow('Nextcloud configuration is incomplete');
    });
    
    it('should initialize with valid config', () => {
      const service = new CalendarService(mockConfig);
      expect(service).toBeDefined();
    });
  });
  
  describe('getCalendars', () => {
    let service: CalendarService;
    
    beforeEach(() => {
      service = new CalendarService(mockConfig);
      
      // Mock the HTTP client's propfind method
      (CalendarHttpClient.prototype.propfind as jest.Mock).mockResolvedValue('<xml>mock response</xml>');
      
      // Mock the XML parsing functions
      (XmlUtils.parseXmlResponse as jest.Mock).mockResolvedValue({ mockXmlData: true });
      (XmlUtils.getMultistatus as jest.Mock).mockReturnValue({ mockMultistatus: true });
      (XmlUtils.getResponses as jest.Mock).mockReturnValue([
        { mockResponse1: true },
        { mockResponse2: true }
      ]);
    });
    
    it('should fetch and parse calendars', async () => {
      // Setup additional mocks to return sample calendars
      jest.spyOn(service as any, 'parseCalendarResponse')
        .mockImplementation((response) => {
          if (response.mockResponse1) return sampleCalendars[0];
          if (response.mockResponse2) return sampleCalendars[1];
          return null;
        });
      
      const result = await service.getCalendars();
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('personal');
      expect(result[1].id).toBe('work');
      
      // Verify HTTP client was called correctly
      expect(CalendarHttpClient.prototype.propfind).toHaveBeenCalledWith(
        expect.any(String) // The PROPFIND XML
      );
    });
    
    it('should handle errors gracefully', async () => {
      // Mock the HTTP client to throw an error
      (CalendarHttpClient.prototype.propfind as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await expect(service.getCalendars()).rejects.toThrow('Failed to fetch calendars');
    });
  });
  
  describe('createCalendar', () => {
    let service: CalendarService;
    
    beforeEach(() => {
      service = new CalendarService(mockConfig);
      
      // Mock the HTTP client methods
      (CalendarHttpClient.prototype.mkcalendar as jest.Mock).mockResolvedValue(undefined);
      (CalendarHttpClient.prototype.proppatch as jest.Mock).mockResolvedValue(undefined);
      (CalendarHttpClient.prototype.getCalDavUrl as jest.Mock).mockReturnValue(
        'https://nextcloud.example.com/remote.php/dav/calendars/testuser/'
      );
    });
    
    it('should create a new calendar with required properties', async () => {
      const newCalendar = {
        displayName: 'New Calendar',
        color: '#00FF00',
        owner: '',
        isDefault: false,
        isShared: false,
        isReadOnly: false,
        permissions: {
          canRead: true,
          canWrite: true,
          canShare: true,
          canDelete: true
        }
      };
      
      const result = await service.createCalendar(newCalendar);
      
      expect(result).toBeDefined();
      expect(result.displayName).toBe('New Calendar');
      expect(result.color).toBe('#00FF00');
      
      // Verify HTTP client was called correctly
      expect(CalendarHttpClient.prototype.mkcalendar).toHaveBeenCalledWith(
        expect.stringContaining('new-calendar-'), // Calendar ID
        expect.any(String) // MKCALENDAR XML
      );
      
      expect(CalendarHttpClient.prototype.proppatch).toHaveBeenCalledWith(
        expect.stringContaining('new-calendar-'), // Calendar ID
        expect.any(String) // PROPPATCH XML
      );
    });
    
    it('should throw an error if displayName is missing', async () => {
      const invalidCalendar = {
        displayName: '',
        color: '#00FF00',
        owner: '',
        isDefault: false,
        isShared: false,
        isReadOnly: false,
        permissions: {
          canRead: true,
          canWrite: true,
          canShare: true,
          canDelete: true
        }
      };
      
      await expect(service.createCalendar(invalidCalendar))
        .rejects.toThrow('Calendar display name is required');
    });
  });
  
  describe('updateCalendar', () => {
    let service: CalendarService;
    
    beforeEach(() => {
      service = new CalendarService(mockConfig);
      
      // Mock getCalendars to return sample calendars
      jest.spyOn(service, 'getCalendars').mockResolvedValue(sampleCalendars);
      
      // Mock the HTTP client methods
      (CalendarHttpClient.prototype.proppatch as jest.Mock).mockResolvedValue(undefined);
    });
    
    it('should update an existing calendar', async () => {
      const updates = {
        displayName: 'Updated Calendar',
        color: '#0000FF'
      };
      
      const result = await service.updateCalendar('personal', updates);
      
      expect(result).toBeDefined();
      expect(result.id).toBe('personal');
      expect(result.displayName).toBe('Updated Calendar');
      expect(result.color).toBe('#0000FF');
      
      // Verify HTTP client was called correctly
      expect(CalendarHttpClient.prototype.proppatch).toHaveBeenCalledWith(
        'personal',
        expect.any(String) // PROPPATCH XML
      );
    });
    
    it('should throw an error if calendar is not found', async () => {
      await expect(service.updateCalendar('non-existent', { displayName: 'Test' }))
        .rejects.toThrow('Calendar with ID non-existent not found');
    });
    
    it('should throw an error if user lacks permission', async () => {
      // Mock a read-only calendar
      jest.spyOn(service, 'getCalendars').mockResolvedValue([
        {
          ...sampleCalendars[0],
          isReadOnly: true,
          permissions: { ...sampleCalendars[0].permissions, canWrite: false }
        }
      ]);
      
      await expect(service.updateCalendar('personal', { displayName: 'Test' }))
        .rejects.toThrow('You do not have permission to modify this calendar');
    });
  });
  
  describe('deleteCalendar', () => {
    let service: CalendarService;
    
    beforeEach(() => {
      service = new CalendarService(mockConfig);
      
      // Mock getCalendars to return sample calendars
      jest.spyOn(service, 'getCalendars').mockResolvedValue(sampleCalendars);
      
      // Mock the HTTP client methods
      (CalendarHttpClient.prototype.deleteCalendar as jest.Mock).mockResolvedValue(undefined);
    });
    
    it('should delete an existing calendar', async () => {
      // Use the non-default calendar for this test
      const result = await service.deleteCalendar('work');
      
      expect(result).toBe(true);
      
      // Verify HTTP client was called correctly
      expect(CalendarHttpClient.prototype.deleteCalendar).toHaveBeenCalledWith('work');
    });
    
    it('should throw an error if calendar is not found', async () => {
      await expect(service.deleteCalendar('non-existent'))
        .rejects.toThrow('Calendar with ID non-existent not found');
    });
    
    it('should throw an error if attempting to delete the default calendar', async () => {
      await expect(service.deleteCalendar('personal'))
        .rejects.toThrow('The default calendar cannot be deleted');
    });
    
    it('should throw an error if user lacks delete permission', async () => {
      // Mock a calendar without delete permission
      jest.spyOn(service, 'getCalendars').mockResolvedValue([
        {
          ...sampleCalendars[1], // Work calendar
          permissions: { ...sampleCalendars[1].permissions, canDelete: false }
        }
      ]);
      
      await expect(service.deleteCalendar('work'))
        .rejects.toThrow('You do not have permission to delete this calendar');
    });
  });
});