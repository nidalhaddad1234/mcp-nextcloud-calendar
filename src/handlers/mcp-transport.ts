import express from 'express';
type Request = express.Request;
type Response = express.Response;
type RequestHandler = express.RequestHandler;
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { v4 as uuidv4 } from 'uuid';
// Import Node.js globals explicitly for ESLint
import { setInterval, clearInterval } from 'node:timers';
// Import config for keep-alive settings
import { loadConfig } from '../config/config.js';

/**
 * Model Context Protocol Transport Implementation
 *
 * This file implements both:
 * 1. Latest MCP Streamable HTTP transport specification (March 2025)
 * 2. Legacy HTTP+SSE transport for backward compatibility
 *
 * The Streamable HTTP transport:
 * - Uses a single endpoint (/mcp) for both SSE streams and client messages
 * - Provides proper session management with Mcp-Session-Id headers
 * - Supports GET, POST, and DELETE methods at a single endpoint
 *
 * Legacy HTTP+SSE transport (for backward compatibility):
 * - Uses separate endpoints for SSE streams (/sse) and messages (/messages)
 * - Maintains the older protocol for clients that don't support Streamable HTTP
 *
 * Implementation:
 * Modern Streamable HTTP:
 * 1. GET /mcp - Initializes an SSE stream for server-to-client communication
 * 2. POST /mcp - Handles client-to-server messages with session management
 * 3. DELETE /mcp - Terminates a session when a client is done
 *
 * Legacy HTTP+SSE:
 * 1. GET /sse - Establishes SSE connection
 * 2. POST /messages?sessionId=X - Sends messages to server
 */

// Store transports by session ID
const transports: { [sessionId: string]: SSEServerTransport } = {};

// Global map to track keep-alive interval timers
const keepAliveTimers: { [sessionId: string]: ReturnType<typeof setInterval> } = {};

// Function to clean up all resources (for testing)
export function cleanupAllResources() {
  // Stop all keep-alive timers
  Object.keys(keepAliveTimers).forEach((sessionId) => {
    clearInterval(keepAliveTimers[sessionId]);
    delete keepAliveTimers[sessionId];
  });

  // Clear all transports
  Object.keys(transports).forEach((sessionId) => {
    delete transports[sessionId];
  });
}

// Get keep-alive interval from config
const config = loadConfig();
const KEEP_ALIVE_INTERVAL = config.server.keepAliveInterval;

/**
 * Starts a keep-alive pinger for a specific session
 * @param sessionId The session ID to track
 * @param res The Express response object to write keep-alive events to
 */
function startKeepAlivePinger(sessionId: string, res: Response): void {
  // Clear existing timer if there is one
  if (keepAliveTimers[sessionId]) {
    clearInterval(keepAliveTimers[sessionId]);
    console.error(`Cleared existing keep-alive timer for session ${sessionId}`);
  }

  // Create a new keep-alive interval
  keepAliveTimers[sessionId] = setInterval(() => {
    try {
      if (transports[sessionId]) {
        res.write('event: ping\\ndata: keep-alive\\n\\n');
        console.error(`Sent keep-alive ping for session ${sessionId}`);
      } else {
        stopKeepAlivePinger(sessionId);
      }
    } catch (error) {
      console.error(`Error sending keep-alive ping for session ${sessionId}:`, error);
      stopKeepAlivePinger(sessionId);
    }
  }, KEEP_ALIVE_INTERVAL);

  console.error(
    `Started keep-alive pinger for session ${sessionId} (interval: ${KEEP_ALIVE_INTERVAL}ms)`,
  );
}

/**
 * Stops a keep-alive pinger for a specific session
 * @param sessionId The session ID to stop pinging
 */
function stopKeepAlivePinger(sessionId: string): void {
  if (keepAliveTimers[sessionId]) {
    clearInterval(keepAliveTimers[sessionId]);
    delete keepAliveTimers[sessionId];
    console.error(`Stopped keep-alive pinger for session ${sessionId}`);
  }
}

/**
 * Cleans up resources when a session is closed
 * @param sessionId The session ID to clean up
 */
function cleanupSession(sessionId: string): void {
  console.error(`Cleaning up session ${sessionId}`);

  // Stop keep-alive pinger
  stopKeepAlivePinger(sessionId);

  // Remove transport
  if (transports[sessionId]) {
    delete transports[sessionId];
    console.error(`Removed transport for session ${sessionId}`);
  }

  console.error(`Active sessions after cleanup: ${Object.keys(transports).length}`);
}

// Streamable HTTP transport handlers
export function setupMcpTransport(server: McpServer) {
  console.error('Setting up MCP transport handlers...');

  // Add global error handler for the MCP server
  server.onerror = (error) => {
    console.error('MCP Server error in transport:', error);
    console.error('Error stack:', error.stack);
  };

  // Unified MCP endpoint - handles both GET for SSE and POST for messages
  // Implements the Streamable HTTP transport (latest spec)
  const mcpHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    console.error(
      `MCP ${req.method} request received, session ID: ${req.headers['mcp-session-id'] || 'none'}`,
    );
    console.error(
      `Active sessions: ${Object.keys(transports).length} [${Object.keys(transports).join(', ')}]`,
    );

    // Add error handling for the response
    res.on('error', (error) => {
      console.error('Response error in MCP handler:', error);
    });

    try {
      // For DELETE requests - terminate session if it exists
      if (req.method === 'DELETE') {
        const sessionId = req.headers['mcp-session-id'] as string;
        if (sessionId && transports[sessionId]) {
          cleanupSession(sessionId);
          res.status(202).end();
          return;
        }
        res.status(404).end();
        return;
      }

      // For GET requests - initialize SSE stream
      if (req.method === 'GET') {
        console.error('Streamable HTTP GET request received (SSE stream)');

        // Set appropriate headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');

        try {
          // Create a new SSE transport for the Streamable HTTP endpoint
          console.error('Creating SSE transport...');
          const transport = new SSEServerTransport('/mcp', res);

          // Use provided session ID if exists, otherwise use transport's generated one
          const sessionId = (req.headers['mcp-session-id'] as string) || transport.sessionId;
          console.error(`Streamable HTTP SSE transport created with sessionId: ${sessionId}`);

          // Store transport with session ID
          transports[sessionId] = transport;
          console.error(
            `Active sessions: ${Object.keys(transports).length} [${Object.keys(transports).join(', ')}]`,
          );

          // Add session ID header if not provided by client
          if (!req.headers['mcp-session-id']) {
            res.setHeader('Mcp-Session-Id', sessionId);
            console.error(`Added Mcp-Session-Id header: ${sessionId}`);
          }

          // Add a close event handler
          res.on('close', () => {
            console.error(`Streamable HTTP SSE connection closed for sessionId: ${sessionId}`);
            cleanupSession(sessionId);
          });

          // Add error handler for the transport
          res.on('error', (error) => {
            console.error(`SSE response error for session ${sessionId}:`, error);
            cleanupSession(sessionId);
          });

          // Connect to the MCP server - this will start the transport automatically
          console.error('Connecting transport to MCP server...');
          await server.connect(transport);
          console.error(`Streamable HTTP SSE transport connected to MCP server`);

          // Start keep-alive pinger
          startKeepAlivePinger(sessionId, res);
        } catch (error) {
          console.error('Error establishing Streamable HTTP SSE connection:', error);
          console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
          if (!res.headersSent) {
            res.status(500).end('Error establishing SSE connection');
          } else {
            res.end();
          }
        }
        return;
      }

      // For POST requests - handle client messages
      if (req.method === 'POST') {
        const sessionId = req.headers['mcp-session-id'] as string;

        // If we have a session ID and an associated transport, handle the message
        if (sessionId && transports[sessionId]) {
          const transport = transports[sessionId];
          try {
            console.error(`Processing message for session ${sessionId}`);

            // Pass parsed body to handlePostMessage to avoid it trying to parse the body again
            await transport.handlePostMessage(req, res, req.body);
            return;
          } catch (error) {
            console.error(`Error handling message for session ${sessionId}:`, error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');

            // Only set status if headers haven't been sent yet
            if (!res.headersSent) {
              res.status(500).json({
                error: 'Error processing message',
                message: error instanceof Error ? error.message : String(error),
              });
            }
            return;
          }
        }

        // If no session ID or no transport found with that ID,
        // this might be an initialization request
        if (!sessionId || !transports[sessionId]) {
          // Generate a new session ID if not provided
          const newSessionId = sessionId || uuidv4();

          // If this is an initialization request, create a new transport
          // Note: We're handling this differently than regular messages
          // as there's no existing transport yet

          // Set the session ID header for the response
          res.setHeader('Mcp-Session-Id', newSessionId);

          // Process the initialization request
          // For now, we'll just accept it with a 202 status
          res.status(202).end();
          return;
        }

        // If we reach here, session ID was provided but no transport exists
        res.status(404).json({
          error: 'Session not found',
          code: -32001,
          message: 'No session found with the provided ID',
        });
        return;
      }

      // Method not allowed for other HTTP methods
      res.status(405).end();
      return;
    } catch (error) {
      console.error('Unexpected error in MCP handler:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      if (!res.headersSent) {
        res.status(500).end('Internal server error');
      }
    }
  };

  // Legacy SSE endpoint handler (for backward compatibility)
  const sseHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    console.error('Legacy SSE connection request received');

    // Add error handling for the response
    res.on('error', (error) => {
      console.error('Response error in SSE handler:', error);
    });

    // Set appropriate headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    try {
      // Create a new SSE transport with the legacy endpoint
      console.error('Creating legacy SSE transport...');
      const transport = new SSEServerTransport('/messages', res);
      const sessionId = transport.sessionId;
      console.error(`Legacy SSE transport created with sessionId: ${sessionId}`);

      // Store the transport by session ID
      transports[sessionId] = transport;
      console.error(
        `Active sessions: ${Object.keys(transports).length} [${Object.keys(transports).join(', ')}]`,
      );

      // Add a close event handler to clean up resources when the connection closes
      res.on('close', () => {
        console.error(`Legacy SSE connection closed for sessionId: ${sessionId}`);
        cleanupSession(sessionId);
      });

      // Add error handler for the transport
      res.on('error', (error) => {
        console.error(`Legacy SSE response error for session ${sessionId}:`, error);
        cleanupSession(sessionId);
      });

      // Connect to the MCP server - this will start the transport automatically
      console.error('Connecting legacy transport to MCP server...');
      await server.connect(transport);
      console.error(`Legacy SSE transport connected to MCP server`);

      // Start keep-alive pinger
      startKeepAlivePinger(sessionId, res);
    } catch (error) {
      console.error('Error establishing SSE connection:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      res.end();
    }
  };

  // Legacy message handling endpoint (for backward compatibility)
  const messageHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.query.sessionId as string;
    console.error(`Legacy message POST received, query sessionId: ${sessionId || 'none'}`);
    console.error(
      `Active sessions: ${Object.keys(transports).length} [${Object.keys(transports).join(', ')}]`,
    );

    // Add error handling for the response
    res.on('error', (error) => {
      console.error('Response error in message handler:', error);
    });

    if (!sessionId) {
      console.error('No session ID provided in request URL');
      res.status(400).json({ error: 'Missing sessionId parameter' });
      return;
    }

    const transport = transports[sessionId];

    if (!transport) {
      console.error(`No transport found for sessionId ${sessionId}`);
      res.status(404).json({ error: 'No transport found for sessionId' });
      return;
    }

    try {
      console.error(`Processing legacy message for session ${sessionId}`);

      // Pass parsed body to handlePostMessage to avoid it trying to parse the body again
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error(`Error handling legacy message for session ${sessionId}:`, error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');

      // Only set status if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Error processing message',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  console.error('MCP transport handlers setup complete');

  return {
    mcpHandler, // Streamable HTTP handler
    sseHandler, // Legacy SSE handler
    messageHandler, // Legacy message handler
    transports,
    keepAliveTimers, // Export timers for testing and debugging
  };
}
