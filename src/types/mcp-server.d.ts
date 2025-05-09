/**
 * Type definitions for Model Context Protocol server
 */

declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  import { z, ZodType } from 'zod';

  interface McpServerOptions {
    name: string;
    version: string;
  }

  interface ToolParameter {
    type: string;
    description: string;
    required?: boolean;
  }

  interface Tool {
    name: string;
    description: string;
    parameters?: Record<string, ToolParameter>;
    execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
  }

  // Tool response interface for the new API
  interface ToolResponse {
    isError?: boolean;
    content: Array<{
      type: string;
      text: string;
    }>;
  }

  // Tool registration interface
  interface ToolRegistration {
    disable(): void;
    enable(): void;
    remove(): void;
  }

  interface McpSession {
    id: string;
    sendMessage(message: Record<string, unknown>): void;
    close(): void;
  }

  // Make the body property optional to accommodate different transport types
  interface McpRequest {
    sessionId?: string;
    session?: McpSession;
    body?: Record<string, unknown>;
  }

  export class McpServer {
    constructor(options: McpServerOptions);

    /**
     * Register a tool with the MCP server (deprecated in v1.11.0)
     * @param tool The tool to register
     */
    registerTool(tool: Tool): void;

    /**
     * Register a tool with the MCP server (new API as of v1.11.0)
     * @param name The name of the tool
     * @param schema A Zod schema object defining the tool's parameters
     * @param handler An async function implementing the tool's logic
     * @returns A ToolRegistration object for controlling the tool
     */
    tool<T extends Record<string, ZodType>>(
      name: string,
      schema: T,
      handler: (args: z.infer<z.ZodObject<T>>) => Promise<ToolResponse>,
    ): ToolRegistration;

    /**
     * Connect a new MCP session
     * @param request The MCP request object
     * @returns Promise that resolves with the session ID
     */
    connect(request: McpRequest): Promise<string>;

    /**
     * Close the server
     * @returns Promise that resolves when the server is closed
     */
    close(): Promise<void>;
  }
}
