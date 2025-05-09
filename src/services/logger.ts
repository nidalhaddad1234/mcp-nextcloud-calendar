/**
 * Logger utility for consistent logging throughout the application
 * Provides different log levels and context-aware logging
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Environment-based log level
const ENV_LOG_LEVEL = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
const DEFAULT_LOG_LEVEL = LogLevel[ENV_LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO;

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Logger class for enhanced logging capabilities
 */
export class Logger {
  private context: string;
  private logLevel: LogLevel;

  /**
   * Creates a new logger instance
   * @param context Context name for this logger
   * @param logLevel Optional override for log level
   */
  constructor(context: string, logLevel?: LogLevel) {
    this.context = context;
    this.logLevel = logLevel !== undefined ? logLevel : DEFAULT_LOG_LEVEL;
  }

  /**
   * Format a log message with timestamp, context and level
   */
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${this.context}] ${level}: ${message}`;
  }

  /**
   * Debug level logging, usually only enabled in development
   */
  debug(message: string, ...optionalParams: unknown[]): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.log(
        COLORS.gray + this.formatMessage('DEBUG', message) + COLORS.reset,
        ...optionalParams
      );
    }
  }

  /**
   * Info level logging for general application information
   */
  info(message: string, ...optionalParams: unknown[]): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(
        COLORS.green + this.formatMessage('INFO', message) + COLORS.reset,
        ...optionalParams
      );
    }
  }

  /**
   * Warning level logging for potential issues that don't block execution
   */
  warn(message: string, ...optionalParams: unknown[]): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(
        COLORS.yellow + this.formatMessage('WARN', message) + COLORS.reset,
        ...optionalParams
      );
    }
  }

  /**
   * Error level logging for actual errors that might affect functionality
   */
  error(message: string, ...optionalParams: unknown[]): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(
        COLORS.red + this.formatMessage('ERROR', message) + COLORS.reset,
        ...optionalParams
      );
    }
  }

  /**
   * Creates a child logger with a sub-context
   * @param subContext The sub-context name
   * @returns A new logger with the combined context
   */
  createChildLogger(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`, this.logLevel);
  }
}

/**
 * Creates a logger instance for a specific context
 * @param context The context identifier for the logger
 * @returns Logger instance
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}