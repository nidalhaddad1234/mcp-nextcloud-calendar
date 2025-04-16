#!/usr/bin/env node
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfig } from './config/config.js';
import { healthHandler } from './handlers/health.js';
import { setupSseHandlers } from './handlers/sse.js';

// Load configuration
const config = loadConfig();

// Create MCP server
const server = new McpServer({
  name: config.serverName,
  version: config.serverVersion,
});

// Setup Express app
const app = express();
app.use(express.json());

// Setup SSE handlers
const { sseHandler, messageHandler } = setupSseHandlers(server);

// Configure routes
app.get('/health', healthHandler(config));
app.get('/sse', sseHandler);
app.post('/messages', messageHandler);

// Graceful shutdown handling
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  server.close().then(() => {
    console.log('Server closed');
    process.exit(0);
  }).catch(err => {
    console.error('Error during shutdown:', err);
    process.exit(1);
  });
};

// Handle termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start the server
app.listen(config.port, () => {
  console.log(`Nextcloud Calendar MCP server running on port ${config.port} in ${config.environment} mode`);
});