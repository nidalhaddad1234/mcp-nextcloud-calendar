#!/usr/bin/env node
// @ts-ignore - Handle ESM/CJS differences
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfig } from './config/config.js';
import { healthHandler } from './handlers/health.js';
import { setupMcpTransport } from './handlers/mcp-transport.js';
import { getCalendarsHandler } from './handlers/calendars.js';
import { CalendarService } from './services/index.js';
import * as os from 'node:os';

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
const app = express();
app.use(express.json());

// Setup handlers
const { mcpHandler, sseHandler, messageHandler } = setupMcpTransport(server);

// Configure routes
app.get('/health', healthHandler(serverConfig));

// Modern Streamable HTTP endpoint
app.all('/mcp', mcpHandler);

// Legacy HTTP+SSE transport endpoints (for backward compatibility)
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

// Get server's IP address(es)
function getServerIpAddresses(): string[] {
  const nets = os.networkInterfaces();
  const results: string[] = [];

  for (const name of Object.keys(nets)) {
    // Type assertion needed since TypeScript doesn't know the structure
    const interfaces = nets[name];
    if (!interfaces) continue;

    for (const net of interfaces) {
      // Skip internal and non-IPv4 addresses
      if (!net.internal && net.family === 'IPv4') {
        results.push(net.address);
      }
    }
  }

  return results.length ? results : ['localhost'];
}

// Start the server
app.listen(serverConfig.port, () => {
  const ipAddresses = getServerIpAddresses();
  const serverName = serverConfig.serverName;
  const serverVersion = serverConfig.serverVersion;

  console.log('='.repeat(80));
  console.log(`Nextcloud Calendar MCP Server v${serverVersion}`);
  console.log('='.repeat(80));

  console.log(`\nEnvironment: ${serverConfig.environment}`);
  console.log(`Server name: ${serverName}`);

  console.log('\nEndpoints available:');
  console.log('-------------------');

  // Display MCP endpoint information for each IP address
  ipAddresses.forEach((ip) => {
    console.log(`MCP Streamable HTTP: http://${ip}:${serverConfig.port}/mcp`);
    console.log(`  - Supports GET (SSE streams), POST (messages), DELETE (session termination)`);
    console.log(`  - MCP Protocol: March 2025 Specification`);

    console.log(`\nLegacy HTTP+SSE endpoints:`);
    console.log(`  - SSE stream: http://${ip}:${serverConfig.port}/sse`);
    console.log(`  - Messages: http://${ip}:${serverConfig.port}/messages?sessionId=X`);
    console.log(`  - MCP Protocol: 2024-11-05 Specification (backward compatibility)`);
  });

  console.log('\nHealth check endpoint:');
  ipAddresses.forEach((ip) => {
    console.log(`  - http://${ip}:${serverConfig.port}/health`);
  });

  console.log('\nCalendar API endpoint:');
  ipAddresses.forEach((ip) => {
    console.log(`  - http://${ip}:${serverConfig.port}/api/calendars`);
  });

  console.log('\nServer is running and ready to accept connections.');
  console.log('='.repeat(80));
});
