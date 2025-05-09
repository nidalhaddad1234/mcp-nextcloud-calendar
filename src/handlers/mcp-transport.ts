import { Request, Response, RequestHandler } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { v4 as uuidv4 } from 'uuid';

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

// Streamable HTTP transport handlers
export function setupMcpTransport(server: McpServer) {
  // Unified MCP endpoint - handles both GET for SSE and POST for messages
  // Implements the Streamable HTTP transport (latest spec)
  const mcpHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    // For DELETE requests - terminate session if it exists
    if (req.method === 'DELETE') {
      const sessionId = req.headers['mcp-session-id'] as string;
      if (sessionId && transports[sessionId]) {
        delete transports[sessionId];
        res.status(202).end();
        return;
      }
      res.status(404).end();
      return;
    }

    // For GET requests - initialize SSE stream
    if (req.method === 'GET') {
      // Set appropriate headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Create a new SSE transport
      const transport = new SSEServerTransport('/mcp', res);
      const sessionId = (req.headers['mcp-session-id'] as string) || transport.sessionId;

      // Store transport with session ID
      transports[sessionId] = transport;

      // Add session ID header if not provided by client
      if (!req.headers['mcp-session-id']) {
        res.setHeader('Mcp-Session-Id', sessionId);
      }

      // Handle connection close
      res.on('close', () => {
        delete transports[sessionId];
      });

      // Connect to the MCP server
      await server.connect(transport);
      return;
    }

    // For POST requests - handle client messages
    if (req.method === 'POST') {
      const sessionId = req.headers['mcp-session-id'] as string;

      // If we have a session ID and an associated transport, handle the message
      if (sessionId && transports[sessionId]) {
        const transport = transports[sessionId];
        await transport.handlePostMessage(req, res);
        return;
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
  };

  // Legacy SSE endpoint handler (for backward compatibility)
  const sseHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    // Set appropriate headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create a new SSE transport with the legacy endpoint
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;

    // Handle connection close
    res.on('close', () => {
      delete transports[transport.sessionId];
    });

    // Connect to the MCP server
    await server.connect(transport);
  };

  // Legacy message handling endpoint (for backward compatibility)
  const messageHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];

    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).json({ error: 'No transport found for sessionId' });
    }
  };

  return {
    mcpHandler, // Streamable HTTP handler
    sseHandler, // Legacy SSE handler
    messageHandler, // Legacy message handler
    transports,
  };
}
