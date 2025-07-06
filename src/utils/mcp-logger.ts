/**
 * MCP-compliant logging utility
 * 
 * The Model Context Protocol (MCP) requires that stdout is reserved ONLY for JSON-RPC messages.
 * All logging and debug output MUST go to stderr to maintain protocol compliance.
 * 
 * This utility provides a consistent logging interface that ensures proper output stream usage.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

/**
 * Creates an MCP-compliant logger that outputs to stderr
 * @param context Optional context prefix for log messages
 * @returns Logger instance
 */
export function createMcpLogger(context?: string): Logger {
  const formatMessage = (level: LogLevel, message: string, ...args: unknown[]): string => {
    const timestamp = new Date().toISOString();
    const prefix = context ? `[${context}]` : '';
    const formattedArgs = args.length > 0 ? ` ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ')}` : '';
    
    return `${timestamp} ${prefix} [${level}] ${message}${formattedArgs}`;
  };

  return {
    error: (message: string, ...args: unknown[]) => {
      console.error(formatMessage('error', message, ...args));
    },
    warn: (message: string, ...args: unknown[]) => {
      console.error(formatMessage('warn', message, ...args));
    },
    info: (message: string, ...args: unknown[]) => {
      console.error(formatMessage('info', message, ...args));
    },
    debug: (message: string, ...args: unknown[]) => {
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
        console.error(formatMessage('debug', message, ...args));
      }
    },
  };
}

/**
 * Default logger instance for the MCP server
 */
export const logger = createMcpLogger('nextcloud-calendar');

/**
 * Simple console.log replacement that routes to stderr
 * Use this as a drop-in replacement for console.log in MCP environments
 */
export function mcpLog(message?: unknown, ...optionalParams: unknown[]): void {
  console.error(message, ...optionalParams);
}

/**
 * Environment check to warn if stdout is being used inappropriately
 */
export function checkMcpCompliance(): void {
  if (process.env.NODE_ENV !== 'test') {
    // Override console.log to warn about stdout usage
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      console.error('WARNING: console.log() detected - this breaks MCP protocol compliance!');
      console.error('Use logger.info() or mcpLog() instead to redirect output to stderr');
      console.error('Original message:', ...args);
    };

    // Provide instructions for fixing
    logger.info('MCP compliance check enabled - all logging must use stderr');
    logger.info('Use logger.info/warn/error or mcpLog() instead of console.log()');
  }
}
