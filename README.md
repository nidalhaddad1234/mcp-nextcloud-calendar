# Nextcloud Calendar MCP Server

[![npm version](https://badge.fury.io/js/%40nidalhaddad1234%2Fmcp-nextcloud-calendar.svg)](https://badge.fury.io/js/%40nidalhaddad1234%2Fmcp-nextcloud-calendar)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A **Model Context Protocol (MCP) compliant** server that integrates Nextcloud Calendar with Claude Desktop and other AI assistants. This server provides seamless calendar management capabilities through natural language interactions.

## 🚀 **Quick Install**

```bash
# Install globally via NPM
npm install -g @nidalhaddad1234/mcp-nextcloud-calendar

# Or install locally
npm install @nidalhaddad1234/mcp-nextcloud-calendar
```

## 📋 **Features**

- ✅ **MCP Protocol Compliant** - Works with Claude Desktop, Claude API, and other MCP clients
- 📅 **Full Calendar Management** - Create, read, update, delete calendars and events
- 🔄 **Real-time Sync** - Direct integration with Nextcloud Calendar via CalDAV
- 🛡️ **Secure Authentication** - Uses Nextcloud app tokens for secure access
- 🌐 **Multi-transport Support** - HTTP, SSE, and WebSocket transports
- 📊 **Rich Event Handling** - Recurring events, reminders, attendees, and more

## ⚡ **Quick Start**

### 1. Install the Package
```bash
npm install -g @nidalhaddad1234/mcp-nextcloud-calendar
```

### 2. Set Environment Variables
Create a `.env` file or set environment variables:
```bash
export NEXTCLOUD_BASE_URL="https://your-nextcloud.example.com"
export NEXTCLOUD_USERNAME="your-username"
export NEXTCLOUD_APP_TOKEN="your-app-token"
```

### 3. Run the Server
```bash
nextcloud-calendar
```

### 4. Configure Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "nextcloud-calendar": {
      "command": "nextcloud-calendar",
      "env": {
        "NEXTCLOUD_BASE_URL": "https://your-nextcloud.example.com",
        "NEXTCLOUD_USERNAME": "your-username",
        "NEXTCLOUD_APP_TOKEN": "your-app-token"
      }
    }
  }
}
```

## 🔧 **Configuration**

### Required Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTCLOUD_BASE_URL` | Your Nextcloud server URL | `https://cloud.example.com` |
| `NEXTCLOUD_USERNAME` | Nextcloud username | `john.doe` |
| `NEXTCLOUD_APP_TOKEN` | Nextcloud app password/token | `abcd-efgh-ijkl-mnop` |

### Optional Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `SERVER_NAME` | `nextcloud-calendar-mcp` | Server identifier |
| `NODE_ENV` | `production` | Environment mode |

### Generate Nextcloud App Token
1. Go to Nextcloud → Settings → Personal → Security
2. Create new App Password
3. Copy the generated token (not your regular password!)

## 🛠️ **Available Tools**

Once connected, you can use these calendar tools through Claude:

### Calendar Management
- `listCalendars` - List all available calendars
- `createCalendar` - Create a new calendar
- `updateCalendar` - Update calendar properties
- `deleteCalendar` - Delete a calendar

### Event Management
- `listEvents` - List events with filtering options
- `createEvent` - Create new events with full details
- `updateEvent` - Update existing events
- `deleteEvent` - Delete events
- `searchEvents` - Search events by text/date

## 💬 **Usage Examples**

After setup, you can interact with your calendar through Claude:

```
"Show me my calendar events for this week"
"Create a meeting tomorrow at 2 PM about project planning"
"What do I have scheduled for Friday?"
"Create a new calendar called 'Personal Projects'"
"Cancel my 3 PM meeting on Thursday"
```

## 🏗️ **Development**

### Local Development
```bash
# Clone the repository
git clone https://github.com/nidalhaddad1234/mcp-nextcloud-calendar.git
cd mcp-nextcloud-calendar

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Testing
```bash
# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

## 🔍 **Troubleshooting**

### Common Issues

**❌ JSON parsing errors in Claude Desktop**
- ✅ **Fixed in v1.0.0+** - All debug output now goes to stderr

**❌ Connection refused**
- Check your Nextcloud URL and credentials
- Ensure app token is correctly generated
- Verify network connectivity

**❌ Calendar tools not appearing**
- Restart Claude Desktop after configuration changes
- Check environment variables are set correctly
- Verify MCP server is running without errors

### Debug Mode
```bash
# Enable debug logging
DEBUG=1 nextcloud-calendar

# Check server status
curl http://localhost:3000/health
```

## 📄 **License**

MIT License - see [LICENSE.md](LICENSE.md)

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 **Support**

- **Issues**: [GitHub Issues](https://github.com/nidalhaddad1234/mcp-nextcloud-calendar/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nidalhaddad1234/mcp-nextcloud-calendar/discussions)
- **Documentation**: [MCP-FIXES.md](MCP-FIXES.md)

## 🌟 **Related Projects**

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Desktop](https://claude.ai/desktop)
- [Nextcloud Calendar](https://apps.nextcloud.com/apps/calendar)

---

**Made with ❤️ for the MCP community**
