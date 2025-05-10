/**
 * Tests for XML API integration
 */
import { XmlAPI, XmlServiceFactory, isCloudflareWorkersEnvironment } from '../services/xml/index.js';
import { WebXmlService } from '../services/xml/web-xml-service.js';
import { XmlService } from '../services/xml/xml-service.js';
import { WebCalDavXmlBuilder } from '../services/xml/web-caldav-xml-builder.js';
import { CalDavXmlBuilder } from '../services/xml/caldav-xml-builder.js';

// Import jest functions
import { jest, describe, expect, test, beforeEach, afterEach } from '@jest/globals';

describe('XmlServiceFactory', () => {
  // Store original properties
  const originalCaches = (globalThis as any).caches;
  const originalAddEventListener = (globalThis as any).addEventListener;
  const originalFetch = (globalThis as any).fetch;
  const originalProcess = (globalThis as any).process;

  afterEach(() => {
    // Reset properties
    (globalThis as any).caches = originalCaches;
    (globalThis as any).addEventListener = originalAddEventListener;
    (globalThis as any).fetch = originalFetch;
    (globalThis as any).process = originalProcess;
  });
  
  test('createXmlService returns XmlService in Node environment', () => {
    // Mock Node.js environment
    (globalThis as any).process = { version: 'v20.0.0' };
    (globalThis as any).caches = undefined;
    
    const service = XmlServiceFactory.createXmlService();
    expect(service).toBeInstanceOf(XmlService);
  });
  
  test('createXmlService returns WebXmlService when forced', () => {
    const service = XmlServiceFactory.createXmlService(true);
    expect(service).toBeInstanceOf(WebXmlService);
  });
  
  test('createCalDavXmlBuilder returns CalDavXmlBuilder in Node environment', () => {
    // Mock Node.js environment
    (globalThis as any).process = { version: 'v20.0.0' };
    (globalThis as any).caches = undefined;
    
    const builder = XmlServiceFactory.createCalDavXmlBuilder();
    expect(builder).toBeInstanceOf(CalDavXmlBuilder);
  });
  
  test('createCalDavXmlBuilder returns WebCalDavXmlBuilder when forced', () => {
    const builder = XmlServiceFactory.createCalDavXmlBuilder(true);
    expect(builder).toBeInstanceOf(WebCalDavXmlBuilder);
  });
});

describe('isCloudflareWorkersEnvironment', () => {
  // Store original properties
  const originalCaches = (globalThis as any).caches;
  const originalAddEventListener = (globalThis as any).addEventListener;
  const originalFetch = (globalThis as any).fetch;
  const originalProcess = (globalThis as any).process;

  afterEach(() => {
    // Reset properties
    (globalThis as any).caches = originalCaches;
    (globalThis as any).addEventListener = originalAddEventListener;
    (globalThis as any).fetch = originalFetch;
    (globalThis as any).process = originalProcess;
  });
  
  test('returns false in Node.js environment', () => {
    // Mock Node.js environment
    (globalThis as any).process = { version: 'v20.0.0' };
    (globalThis as any).caches = undefined;
    (globalThis as any).addEventListener = undefined;
    
    expect(isCloudflareWorkersEnvironment()).toBe(false);
  });
  
  test('returns true in Cloudflare Workers environment', () => {
    // Mock Cloudflare Workers environment
    (globalThis as any).process = undefined;
    (globalThis as any).caches = {};
    (globalThis as any).addEventListener = () => {};
    (globalThis as any).fetch = () => {};
    
    expect(isCloudflareWorkersEnvironment()).toBe(true);
  });
});

describe('XmlAPI', () => {
  let api: XmlAPI;
  
  beforeEach(() => {
    api = new XmlAPI();
  });
  
  test('escapeXml delegates to underlying service', () => {
    const spy = jest.spyOn(XmlService.prototype, 'escapeXml');
    api.escapeXml('<test>');
    expect(spy).toHaveBeenCalledWith('<test>');
  });
  
  test('formatUTCDate delegates to underlying service', () => {
    const spy = jest.spyOn(XmlService.prototype, 'formatUTCDate');
    const date = new Date();
    api.formatUTCDate(date);
    expect(spy).toHaveBeenCalledWith(date);
  });
  
  test('parseXml validates and sanitizes XML before parsing', async () => {
    const validateSpy = jest.spyOn(api, 'validateXml').mockReturnValue({
      valid: false,
      issues: ['Test issue']
    });
    
    const sanitizeSpy = jest.spyOn(api, 'sanitizeXml').mockReturnValue('<root>sanitized</root>');
    
    const parseSpy = jest.spyOn(XmlService.prototype, 'parseXml')
      .mockResolvedValue({ root: 'sanitized' });
    
    await api.parseXml('<root>test</root>');
    
    expect(validateSpy).toHaveBeenCalledWith('<root>test</root>');
    expect(sanitizeSpy).toHaveBeenCalledWith('<root>test</root>');
    expect(parseSpy).toHaveBeenCalledWith('<root>sanitized</root>', undefined);
  });
  
  test('parseXml skips sanitization for valid XML', async () => {
    const validateSpy = jest.spyOn(api, 'validateXml').mockReturnValue({
      valid: true,
      issues: []
    });
    
    const sanitizeSpy = jest.spyOn(api, 'sanitizeXml');
    
    const parseSpy = jest.spyOn(XmlService.prototype, 'parseXml')
      .mockResolvedValue({ root: 'test' });
    
    await api.parseXml('<root>test</root>');
    
    expect(validateSpy).toHaveBeenCalledWith('<root>test</root>');
    expect(sanitizeSpy).not.toHaveBeenCalled();
    expect(parseSpy).toHaveBeenCalledWith('<root>test</root>', undefined);
  });
  
  test('buildPropfindRequest delegates to CalDAV builder', () => {
    const spy = jest.spyOn(CalDavXmlBuilder.prototype, 'buildPropfindRequest');
    api.buildPropfindRequest(['prop1', 'prop2']);
    expect(spy).toHaveBeenCalledWith(['prop1', 'prop2']);
  });
  
  test('buildMkcalendarRequest delegates to CalDAV builder', () => {
    const spy = jest.spyOn(CalDavXmlBuilder.prototype, 'buildMkcalendarRequest');
    api.buildMkcalendarRequest('Test Calendar', '#ff0000');
    expect(spy).toHaveBeenCalledWith('Test Calendar', '#ff0000');
  });
  
  test('buildProppatchRequest delegates to CalDAV builder', () => {
    const spy = jest.spyOn(CalDavXmlBuilder.prototype, 'buildProppatchRequest');
    const props = { displayName: 'Test', color: '#00ff00' };
    api.buildProppatchRequest(props);
    expect(spy).toHaveBeenCalledWith(props);
  });
  
  test('buildCalendarQueryReport delegates to CalDAV builder', () => {
    const spy = jest.spyOn(CalDavXmlBuilder.prototype, 'buildCalendarQueryReport');
    const timeRange = {
      start: new Date('2023-01-01'),
      end: new Date('2023-12-31')
    };
    api.buildCalendarQueryReport(timeRange);
    expect(spy).toHaveBeenCalledWith(timeRange);
  });
  
  test('buildEventByUidRequest delegates to CalDAV builder', () => {
    const spy = jest.spyOn(CalDavXmlBuilder.prototype, 'buildEventByUidRequest');
    api.buildEventByUidRequest('event123');
    expect(spy).toHaveBeenCalledWith('event123');
  });
  
  test('parseMultistatus delegates to CalDAV builder', () => {
    const spy = jest.spyOn(CalDavXmlBuilder.prototype, 'parseMultistatus');
    const data = { 'd:multistatus': { 'd:response': [] } };
    api.parseMultistatus(data);
    expect(spy).toHaveBeenCalledWith(data);
  });
});

describe('XML Module Exports', () => {
  test('default export is an XmlAPI instance', () => {
    // Import from the module
    const xmlApi = XmlAPI;
    expect(xmlApi).toBeDefined();
  });

  test('all required types and classes are exported', () => {
    // Check core API
    expect(typeof XmlAPI).toBe('function');
    expect(typeof XmlServiceFactory).toBe('function');
    expect(typeof isCloudflareWorkersEnvironment).toBe('function');

    // Check original implementations
    expect(typeof XmlService).toBe('function');
    expect(typeof WebXmlService).toBe('function');
    expect(typeof WebCalDavXmlBuilder).toBe('function');
  });
});