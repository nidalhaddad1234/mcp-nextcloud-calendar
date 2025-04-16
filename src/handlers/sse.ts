import { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// Store transports by session ID
const transports: { [sessionId: string]: SSEServerTransport } = {};

export function setupSseHandlers(server: McpServer) {
  // SSE endpoint for connecting clients
  const sseHandler = async (_: Request, res: Response) => {
    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;

    res.on('close', () => {
      delete transports[transport.sessionId];
    });

    await server.connect(transport);
  };

  // Message handling endpoint
  const messageHandler = async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];

    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).json({ error: 'No transport found for sessionId' });
    }
  };

  return {
    sseHandler,
    messageHandler,
    transports
  };
}
