// Mock McpServer implementation
export class McpServer {
  constructor(options) {
    this.options = options;
    this.tools = {};
  }

  tool(name, schema, handler) {
    this.tools[name] = { schema, handler };
    return this;
  }

  connect() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
}