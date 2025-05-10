/**
 * XML Security utilities for preventing common XML vulnerabilities
 */
import { createLogger } from '../logger.js';

const logger = createLogger('XmlSecurity');

/**
 * Maximum entity expansion limit to prevent billion laughs attacks
 */
const DEFAULT_ENTITY_EXPANSION_LIMIT = 10000;

/**
 * Maximum XML depth to prevent deeply nested XML bombs
 */
const MAX_XML_DEPTH = 100;

/**
 * Maximum XML document size in bytes
 */
const MAX_XML_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Security options for XML processing
 */
export interface XmlSecurityOptions {
  /**
   * Whether to disable entity expansion entirely
   */
  disableEntityExpansion?: boolean;
  
  /**
   * Maximum number of entity expansions allowed
   */
  entityExpansionLimit?: number;
  
  /**
   * Maximum XML document depth
   */
  maxDepth?: number;
  
  /**
   * Maximum XML document size in bytes
   */
  maxSize?: number;
  
  /**
   * Whether to allow external DTDs
   */
  allowExternalDTD?: boolean;
  
  /**
   * Whether to allow DTDs at all
   */
  allowDTD?: boolean;
}

/**
 * Default security options for XML processing
 */
export const DEFAULT_SECURITY_OPTIONS: XmlSecurityOptions = {
  disableEntityExpansion: true,
  entityExpansionLimit: DEFAULT_ENTITY_EXPANSION_LIMIT,
  maxDepth: MAX_XML_DEPTH,
  maxSize: MAX_XML_SIZE,
  allowExternalDTD: false,
  allowDTD: false,
};

/**
 * Utility class for enhancing XML security
 */
export class XmlSecurity {
  /**
   * Validates XML against security options
   * 
   * @param xmlString XML string to validate
   * @param options Security options
   * @returns Validation result with potential issues
   */
  static validateXml(
    xmlString: string, 
    options: XmlSecurityOptions = DEFAULT_SECURITY_OPTIONS
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const mergedOptions = { ...DEFAULT_SECURITY_OPTIONS, ...options };
    
    // Check size
    if (xmlString.length > (mergedOptions.maxSize || MAX_XML_SIZE)) {
      issues.push(`XML document exceeds maximum size of ${mergedOptions.maxSize} bytes`);
    }
    
    // Check for DOCTYPE declaration
    if (!mergedOptions.allowDTD && xmlString.includes('<!DOCTYPE')) {
      issues.push('DOCTYPE declarations are not allowed');
    }
    
    // Check for external DTD
    if (!mergedOptions.allowExternalDTD && 
        (xmlString.includes('<!DOCTYPE') && 
         (xmlString.includes('SYSTEM') || xmlString.includes('PUBLIC')))) {
      issues.push('External DTDs are not allowed');
    }
    
    // Check for entity declarations
    if (mergedOptions.disableEntityExpansion && xmlString.includes('<!ENTITY')) {
      issues.push('Entity declarations are not allowed when entity expansion is disabled');
    }
    
    // Check XML depth
    const depth = XmlSecurity.estimateXmlDepth(xmlString);
    if (depth > (mergedOptions.maxDepth || MAX_XML_DEPTH)) {
      issues.push(`XML document exceeds maximum depth of ${mergedOptions.maxDepth} levels`);
    }
    
    // Log any issues
    if (issues.length > 0) {
      logger.warn('XML security validation failed:', issues);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  /**
   * Estimates the depth of an XML document
   * This is a simple heuristic and not a full XML parser
   * 
   * @param xmlString XML string to analyze
   * @returns Estimated depth
   */
  private static estimateXmlDepth(xmlString: string): number {
    let currentDepth = 0;
    let maxDepth = 0;
    let inTag = false;
    let inQuote = false;
    let quoteChar = '';
    let inComment = false;
    let inCdata = false;
    let skipNextChar = false;
    
    for (let i = 0; i < xmlString.length; i++) {
      const char = xmlString[i];
      const nextChar = i < xmlString.length - 1 ? xmlString[i + 1] : '';
      
      if (skipNextChar) {
        skipNextChar = false;
        continue;
      }
      
      // Handle comments
      if (!inComment && !inCdata && char === '<' && nextChar === '!') {
        if (xmlString.substring(i, i + 4) === '<!--') {
          inComment = true;
          continue;
        } else if (xmlString.substring(i, i + 9) === '<![CDATA[') {
          inCdata = true;
          continue;
        }
      }
      
      if (inComment) {
        if (char === '-' && nextChar === '-' && i < xmlString.length - 2 && xmlString[i + 2] === '>') {
          inComment = false;
          skipNextChar = true; // Skip the next '-'
        }
        continue;
      }
      
      if (inCdata) {
        if (char === ']' && nextChar === ']' && i < xmlString.length - 2 && xmlString[i + 2] === '>') {
          inCdata = false;
          skipNextChar = true; // Skip the next ']'
        }
        continue;
      }
      
      // Handle quotes
      if (inTag && !inQuote && (char === '"' || char === "'")) {
        inQuote = true;
        quoteChar = char;
        continue;
      }
      
      if (inQuote && char === quoteChar) {
        inQuote = false;
        continue;
      }
      
      // Skip processing while in quotes
      if (inQuote) continue;
      
      // Handle tags
      if (!inTag && char === '<' && nextChar !== '/') {
        inTag = true;
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
        continue;
      }
      
      if (!inTag && char === '<' && nextChar === '/') {
        // Closing tag
        currentDepth--;
        continue;
      }
      
      if (inTag && char === '>') {
        inTag = false;
        // Handle self-closing tags
        if (xmlString[i - 1] === '/') {
          currentDepth--;
        }
        continue;
      }
    }
    
    return maxDepth;
  }
  
  /**
   * Sanitizes XML to remove potentially dangerous content
   * 
   * @param xmlString XML string to sanitize
   * @returns Sanitized XML string
   */
  static sanitizeXml(xmlString: string): string {
    let sanitized = xmlString;
    
    // Remove all DOCTYPE declarations
    sanitized = sanitized.replace(/<!DOCTYPE[^>]*>/gi, '');
    
    // Remove all entity declarations
    sanitized = sanitized.replace(/<!ENTITY[^>]*>/gi, '');
    
    // Remove processing instructions
    sanitized = sanitized.replace(/<\?[^>]*\?>/gi, '');
    
    return sanitized;
  }
  
  /**
   * Creates safe XML parser options for fast-xml-parser
   * 
   * @param options Security options
   * @returns Safe parser options
   */
  static createSafeParserOptions(options: XmlSecurityOptions = {}): Record<string, unknown> {
    const mergedOptions = { ...DEFAULT_SECURITY_OPTIONS, ...options };
    
    return {
      isArray: (name: string): boolean => {
        // Force arrays for specific elements that can appear multiple times
        if (/response$/.test(name) || /href$/.test(name) || /propstat$/.test(name)) {
          return true;
        }
        return false;
      },
      attributeNamePrefix: '$_',
      attributesGroupName: '$',
      textNodeName: '#text',
      ignoreAttributes: false,
      parseAttributeValue: true,
      trimValues: true,
      
      // Security settings
      allowBooleanAttributes: true,
      processEntities: !mergedOptions.disableEntityExpansion,
      ignoreDeclaration: false,
      
      // Don't parse values to maintain original format
      parseTagValue: false,
      cdataTagName: '#cdata',
      
      // Additional security option 
      // This option is specific to fast-xml-parser and limits entity depth
      stopNodes: [
        'd:response.d:propstat.d:prop'
      ],
    };
  }
  
  /**
   * Detects potential XXE attacks in XML
   * 
   * @param xmlString XML string to analyze
   * @returns Detection result with details
   */
  static detectXxeAttempt(xmlString: string): { detected: boolean; details: string } {
    // Check for external entity declarations
    const systemPattern = /<!ENTITY\s+\w+\s+SYSTEM\s+['"](file|https?|ftp):\/\/[^'"]+['"]\s*>/i;
    const publicPattern = /<!ENTITY\s+\w+\s+PUBLIC\s+['"][^'"]*['"]\s+['"](file|https?|ftp):\/\/[^'"]+['"]\s*>/i;
    
    const systemMatch = systemPattern.exec(xmlString);
    if (systemMatch) {
      return {
        detected: true,
        details: `External entity using SYSTEM detected: ${systemMatch[0]}`
      };
    }
    
    const publicMatch = publicPattern.exec(xmlString);
    if (publicMatch) {
      return {
        detected: true,
        details: `External entity using PUBLIC detected: ${publicMatch[0]}`
      };
    }
    
    // Check for parameter entity attack patterns
    const parameterEntityPattern = /<!ENTITY\s+%\s+\w+\s+/i;
    const paramMatch = parameterEntityPattern.exec(xmlString);
    if (paramMatch) {
      return {
        detected: true,
        details: `Parameter entity detected, potential XXE attack: ${paramMatch[0]}`
      };
    }
    
    return {
      detected: false,
      details: 'No XXE attack patterns detected'
    };
  }
  
  /**
   * Detects billion laughs / entity expansion attacks
   * 
   * @param xmlString XML string to analyze
   * @returns Detection result with details
   */
  static detectEntityExpansionAttack(xmlString: string): { detected: boolean; details: string } {
    // Look for nested entity declarations
    const entityPattern = /<!ENTITY\s+(\w+)\s+['"](?:&\w+;|[^'"]*)+['"]\s*>/gi;
    const entities: string[] = [];
    let match;
    
    while ((match = entityPattern.exec(xmlString)) !== null) {
      entities.push(match[1]);
    }
    
    // Check for entity references within entity declarations
    for (const entity of entities) {
      const referencePattern = new RegExp(`<!ENTITY\\s+\\w+\\s+['"][^'"]*&${entity};[^'"]*['"]\\s*>`, 'i');
      if (referencePattern.test(xmlString)) {
        return {
          detected: true,
          details: `Detected nested entity reference to &${entity}; - possible billion laughs attack`
        };
      }
    }
    
    // Check for suspicious repetitive patterns
    const repetitionPattern = /(&\w+;)(?:&\w+;){10,}/;
    const repetitionMatch = repetitionPattern.exec(xmlString);
    if (repetitionMatch) {
      return {
        detected: true,
        details: `Detected repetitive entity references starting with ${repetitionMatch[1]} - possible entity expansion attack`
      };
    }
    
    return {
      detected: false,
      details: 'No entity expansion attack patterns detected'
    };
  }
}