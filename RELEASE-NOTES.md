# Release Notes

## Version 1.0.0 - MCP Protocol Compliance Fix

### 🐛 **Critical Fixes**
- **Fixed JSON parsing errors in Claude Desktop** - Server now fully complies with MCP protocol
- **Redirected all debug output to stderr** - stdout reserved for JSON-RPC messages only
- **Eliminated ANSI color codes** from protocol communication
- **Fixed session management** in transport handlers

### ✨ **New Features**  
- **MCP-compliant logging utility** - Prevents future stdout pollution
- **Enhanced error handling** - Better error messages and debugging
- **Comprehensive documentation** - Setup guides and troubleshooting
- **NPM publishing ready** - Professional package configuration

### 🔧 **Technical Improvements**
- Added `src/utils/mcp-logger.ts` for structured logging
- Updated `src/index.ts` to use stderr for all debug output  
- Fixed `src/handlers/mcp-transport.ts` logging issues
- Enhanced `package.json` with proper metadata for publishing

### 📚 **Documentation**
- Added `MCP-FIXES.md` with detailed fix documentation
- Updated `README.md` with comprehensive setup instructions
- Added troubleshooting guides for common issues

### 🚀 **Installation**
```bash
# NPM (recommended)
npm install -g @nidalhaddad1234/mcp-nextcloud-calendar

# Or download from GitHub releases
wget https://github.com/nidalhaddad1234/mcp-nextcloud-calendar/archive/v1.0.0.tar.gz
```

### 🔄 **Breaking Changes**
- None - this is a compatibility fix

### 🙏 **Acknowledgments**
- Original work by [Cheffromspace](https://github.com/Cheffromspace/mcp-nextcloud-calendar)
- MCP protocol fixes for Claude Desktop compatibility

---

**Full Changelog**: https://github.com/nidalhaddad1234/mcp-nextcloud-calendar/compare/v0.1.0...v1.0.0
