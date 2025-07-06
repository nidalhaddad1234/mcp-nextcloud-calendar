# 🗓️ MCP Nextcloud Calendar Server

[![npm version](https://badge.fury.io/js/@nidalhaddad1234/mcp-nextcloud-calendar.svg)](https://badge.fury.io/js/@nidalhaddad1234/mcp-nextcloud-calendar)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)

A **fully MCP-compliant** server that integrates Nextcloud Calendar with Claude Desktop and other Model Context Protocol clients. Now with **fixed JSON parsing issues** and complete protocol compliance!

## ✨ **Key Features**

- 🔗 **Complete Nextcloud Calendar Integration** - List, create, update, and delete calendars
- 📅 **Full Event Management** - Create, read, update, delete calendar events  
- 🤖 **Claude Desktop Compatible** - Works seamlessly with Claude Desktop
- 🔒 **Secure Authentication** - Uses Nextcloud app tokens
- 🚀 **MCP Protocol Compliant** - Follows latest MCP specification
- 🛠️ **Easy Installation** - One command setup via NPM

## 🚀 **Quick Start**

### Install via NPM
```bash
npm install -g @nidalhaddad1234/mcp-nextcloud-calendar
```

### Install via Git
```bash
git clone https://github.com/nidalhaddad1234/mcp-nextcloud-calendar.git
cd mcp-nextcloud-calendar
npm install
npm run build
```

## ⚙️ **Configuration**

### 1. Set up Nextcloud App Token
1. Go to your Nextcloud instance → Settings → Security
2. Create a new "App password" for the MCP server
3. Copy the generated token

### 2. Environment Variables
Create a `.env` file or set these environment variables:

```bash
NEXTCLOUD_BASE_URL=https://your-nextcloud.example.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_APP_TOKEN=your-app-token

# Optional
PORT=3000
SERVER_NAME=nextcloud-calendar-mcp
SERVER_VERSION=1.0.0
NODE_ENV=production
```

### 3. Claude Desktop Configuration
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nextcloud-calendar": {
      "command": "mcp-nextcloud-calendar",
      "env": {
        "NEXTCLOUD_BASE_URL": "https://your-nextcloud.example.com",
        "NEXTCLOUD_USERNAME": "your-username",
        "NEXTCLOUD_APP_TOKEN": "your-app-token"
      }
    }
  }
}
```

## 🔧 **Available Tools**

### Calendar Management
- `listCalendars` - Get all available calendars
- `createCalendar` - Create a new calendar
- `updateCalendar` - Update calendar properties  
- `deleteCalendar` - Remove a calendar

### Event Management
- `listEvents` - Get events from calendars
- `createEvent` - Create new calendar events
- `updateEvent` - Modify existing events
- `deleteEvent` - Remove events
- `searchEvents` - Find events by criteria

## 🐛 **Troubleshooting**

### JSON Parsing Errors (Fixed!)
This version fixes the common JSON parsing errors that occurred with previous versions:
- ✅ All debug output now goes to stderr (MCP compliant)
- ✅ Clean JSON-RPC communication on stdout
- ✅ No more "Unexpected token" errors in Claude Desktop

### Connection Issues
```bash
# Test server manually
mcp-nextcloud-calendar

# Check Nextcloud connectivity
curl -u "username:app-token" "https://your-nextcloud.example.com/remote.php/dav/calendars/username/"
```

### Common Problems
- **404 Errors**: Check NEXTCLOUD_BASE_URL format (include https://)
- **Auth Errors**: Verify NEXTCLOUD_APP_TOKEN is correct
- **Network Issues**: Ensure Nextcloud is accessible from your machine

## 🧪 **Development**

```bash
# Clone and setup
git clone https://github.com/nidalhaddad1234/mcp-nextcloud-calendar.git
cd mcp-nextcloud-calendar
npm install

# Development workflow
npm run dev          # Build and run
npm run dev:watch    # Watch mode
npm run test         # Run tests
npm run lint         # Code quality
npm run format       # Code formatting
```

## 🔄 **API Endpoints**

The server also exposes HTTP endpoints for testing:

- `GET /health` - Health check
- `GET /api/calendars` - List calendars via REST
- `GET /mcp` - MCP Streamable HTTP endpoint
- `GET /sse` - Legacy SSE endpoint (backward compatibility)

## 📝 **Protocol Compliance**

This server implements:
- ✅ **MCP Streamable HTTP** (March 2025 specification)
- ✅ **Legacy HTTP+SSE** (2024-11-05 specification) 
- ✅ **Proper stdout/stderr separation**
- ✅ **Session management**
- ✅ **Error handling**

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 **License**

This project is licensed under the ISC License - see the [LICENSE.md](LICENSE.md) file for details.

## 🙏 **Acknowledgments**

- Based on the original work by [Cheffromspace](https://github.com/Cheffromspace/mcp-nextcloud-calendar)
- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Fixes applied for Claude Desktop compatibility

## 🔗 **Links**

- [GitHub Repository](https://github.com/nidalhaddad1234/mcp-nextcloud-calendar)
- [NPM Package](https://www.npmjs.com/package/@nidalhaddad1234/mcp-nextcloud-calendar)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/desktop)

---

**Need help?** [Open an issue](https://github.com/nidalhaddad1234/mcp-nextcloud-calendar/issues) on GitHub!
