# MCP Protocol Compliance Fixes

This document explains the critical fixes applied to make the Nextcloud Calendar MCP server compatible with Claude Desktop and other MCP clients.

## Problem Summary

The original implementation had JSON parsing errors in Claude Desktop because:

1. **Debug output was sent to stdout**: The MCP protocol requires that **only JSON-RPC messages** go to stdout
2. **All logging/debug information** must go to stderr
3. **ANSI color codes** in output were breaking JSON parsing

## Root Cause Analysis

The log errors showed:
```
Unexpected token '\u001b', "\u001b[32m2025-"... is not valid JSON
Unexpected token 'b', "  baseUrl: '"... is not valid JSON
Unexpected token 'C', "Calendar s"... is not valid JSON
```

These errors occurred because:
- `console.log()` statements were outputting to stdout
- Mixed debug output with JSON-RPC protocol messages
- ANSI escape sequences (`\u001b`) from colored terminal output

## Fixes Applied

### 1. Fixed Main Server (`src/index.ts`)
- ✅ Changed all `console.log()` to `console.error()`
- ✅ Redirected debug output to stderr
- ✅ Maintained all functionality while fixing protocol compliance

### 2. Fixed Transport Handler (`src/handlers/mcp-transport.ts`)
- ✅ Changed all `console.log()` to `console.error()`
- ✅ Fixed session management logging
- ✅ Ensured transport debugging goes to stderr

### 3. Added MCP Logger Utility (`src/utils/mcp-logger.ts`)
- ✅ Provides structured logging that automatically uses stderr
- ✅ Includes compliance checking to prevent future stdout usage
- ✅ Drop-in replacement for console.log with `mcpLog()`

## Testing the Fix

### 1. Build and Test
```bash
# Clone the fixed version
git clone -b fix-mcp-stdout-issues https://github.com/nidalhaddad1234/mcp-nextcloud-calendar.git
cd mcp-nextcloud-calendar

# Install dependencies
npm install

# Build the project
npm run build

# Test that only JSON goes to stdout
node build/index.js | jq .
# Should show valid JSON objects only, no debug text
```

### 2. Verify MCP Compliance
```bash
# Run the server and check outputs
node build/index.js 2>/dev/null | head -10
# Should only show JSON-RPC messages if any

# Check that debug info goes to stderr
node build/index.js >/dev/null
# Should show startup messages and debug info
```

## Environment Variables Required

Create a `.env` file:
```bash
# Required for full functionality
NEXTCLOUD_BASE_URL=https://your-nextcloud.example.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_APP_TOKEN=your-app-token

# Optional (will use defaults)
PORT=3000
SERVER_NAME=nextcloud-calendar-mcp
SERVER_VERSION=0.1.0
NODE_ENV=production
```

## Claude Desktop Configuration

Update your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nextcloud-calendar": {
      "command": "node",
      "args": ["/path/to/mcp-nextcloud-calendar/build/index.js"],
      "env": {
        "NEXTCLOUD_BASE_URL": "https://your-nextcloud.example.com",
        "NEXTCLOUD_USERNAME": "your-username", 
        "NEXTCLOUD_APP_TOKEN": "your-app-token"
      }
    }
  }
}
```

## Key Changes Made

### Before (Broken)
```javascript
console.log('Server started successfully');           // ❌ Goes to stdout
console.log('Configuration:', config);                // ❌ Breaks MCP protocol
console.log(`Session created: ${sessionId}`);         // ❌ Mixed with JSON-RPC
```

### After (Fixed)
```javascript
console.error('Server started successfully');         // ✅ Goes to stderr
console.error('Configuration:', config);              // ✅ MCP compliant
console.error(`Session created: ${sessionId}`);       // ✅ Proper logging
```

## Future Development Guidelines

### 1. Always Use Stderr for Logging
```javascript
// ✅ Correct
console.error('Debug message');
logger.info('Application started');
mcpLog('Simple debug output');

// ❌ Incorrect - breaks MCP protocol
console.log('Debug message');
```

### 2. Use the MCP Logger
```javascript
import { logger, mcpLog } from './utils/mcp-logger.js';

// Structured logging
logger.info('Calendar service initialized');
logger.error('Failed to connect', error);

// Simple logging
mcpLog('Quick debug message');
```

### 3. Enable Compliance Checking
```javascript
import { checkMcpCompliance } from './utils/mcp-logger.js';

// Add to your main file to catch violations
checkMcpCompliance();
```

## Verification Commands

```bash
# 1. Test JSON output only
node build/index.js | jq . > /dev/null && echo "✅ Valid JSON output"

# 2. Test stderr logging
node build/index.js 2>&1 >/dev/null | grep -q "Server started" && echo "✅ Stderr logging works"

# 3. Test MCP client connection
# Use Claude Desktop or another MCP client to verify functionality
```

## Troubleshooting

### If you still see JSON errors:
1. Make sure you're using the fixed branch: `fix-mcp-stdout-issues`
2. Rebuild with `npm run build`
3. Check that no console.log statements remain: `grep -r "console\.log" src/`

### If Claude Desktop doesn't connect:
1. Check your environment variables in claude_desktop_config.json
2. Verify the path to build/index.js is correct
3. Test the server manually first with curl

### If calendar features don't work:
1. Ensure NEXTCLOUD_BASE_URL, NEXTCLOUD_USERNAME, and NEXTCLOUD_APP_TOKEN are set
2. Test Nextcloud connectivity manually
3. Check stderr output for specific error messages

## What This Fixes

- ✅ JSON parsing errors in Claude Desktop
- ✅ MCP protocol compliance
- ✅ Session management issues
- ✅ Transport layer communication
- ✅ Calendar tool functionality
- ✅ Server startup and logging

The server now properly implements the MCP protocol specification and should work seamlessly with Claude Desktop and other MCP clients.
