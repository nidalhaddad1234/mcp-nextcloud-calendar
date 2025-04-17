#!/usr/bin/env node
import * as express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfig } from './config/config.js';
import { healthHandler } from './handlers/health.js';
import { setupSseHandlers } from './handlers/sse.js';
import { getCalendarsHandler } from './handlers/calendars.js';
import { CalendarService } from './services/index.js';

// Load configuration
const config = loadConfig();
const { server: serverConfig, nextcloud: nextcloudConfig } = config;

// Initialize services
let calendarService: CalendarService | null = null;
try {
  if (nextcloudConfig.baseUrl && nextcloudConfig.username && nextcloudConfig.appToken) {
    calendarService = new CalendarService(nextcloudConfig);
    console.log('Calendar service initialized successfully');
  } else {
    console.warn('Nextcloud configuration incomplete - Calendar service not initialized');
  }
} catch (error) {
  console.error('Failed to initialize calendar service:', error);
}

// Create MCP server
const server = new McpServer({
  name: serverConfig.serverName,
  version: serverConfig.serverVersion,
});

// Setup Express app
const app = express.default();
app.use(express.default.json());

// Setup handlers
const { sseHandler, messageHandler } = setupSseHandlers(server);

// Configure routes
app.get('/health', healthHandler(serverConfig));
app.get('/sse', sseHandler);
app.post('/messages', messageHandler);

// Calendar routes
app.get('/api/calendars', getCalendarsHandler(calendarService));

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  server
    .close()
    .then(() => {
      console.log('Server closed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error during shutdown:', err);
      process.exit(1);
    });
};

// Handle termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
app.listen(serverConfig.port, () => {
  console.log(
    `Nextcloud Calendar MCP server running on port ${serverConfig.port} in ${serverConfig.environment} mode`,
  );
});
