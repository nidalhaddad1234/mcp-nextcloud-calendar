# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Run
- `npm run build` - Build the project (compiles TypeScript)
- `npm run start` - Run the built application
- `npm run dev` - Build and run the application in development mode
- `npm run dev:watch` - Watch for changes and rebuild automatically

### Testing and Code Quality
- `npm run test` - Run tests with Jest
- `npm run lint` - Run ESLint for static code analysis
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting without modifying files
- `npm run typecheck` - Run TypeScript type checking without emitting files

## Project Architecture

### Overview
This project is a Model Context Protocol (MCP) server for Nextcloud Calendar integration. It allows fetching calendars from Nextcloud, manipulating calendar data, and exposes this functionality through MCP-compatible endpoints.

### Core Components

1. **MCP Server Implementation**
   - Implements the Model Context Protocol for AI agent integration
   - Supports both the latest Streamable HTTP transport (March 2025 spec) and legacy HTTP+SSE transport
   - Handles session management and connection keep-alive

2. **Calendar Service**
   - Communicates with Nextcloud's CalDAV API
   - Retrieves calendar information using WebDAV PROPFIND requests
   - Handles authentication via Basic Auth with Nextcloud
   - Includes ADHD-friendly organization features

3. **API Endpoints**
   - `/mcp` - Primary MCP endpoint (streamable HTTP)
   - `/sse` and `/messages` - Legacy MCP endpoints
   - `/health` - Health check endpoint
   - `/api/calendars` - REST API for calendar data

### Data Models
The application uses TypeScript interfaces to define clear data structures:
- `Calendar` - Represents a Nextcloud calendar with properties like ID, name, color, and permissions
- `Event` - Calendar events with start/end dates, recurrence rules, and ADHD-specific metadata
- `Participant` - Event attendees with status and role information
- `RecurrenceRule` - Defines repeating event patterns

### Configuration
Configuration is loaded from environment variables with defaults:
- Server settings (port, name, version)
- Nextcloud credentials (base URL, username, app token)
- Keep-alive interval for MCP connections

## Common Development Tasks

### Adding a New API Endpoint
1. Create a handler function in the appropriate file in `src/handlers/`
2. Add the route in `src/index.ts`
3. Implement any necessary service methods in `src/services/`

### Extending Calendar Functionality
1. Add or modify interfaces in `src/models/calendar.ts`
2. Implement service methods in `src/services/calendar.service.ts`
3. Create handlers in `src/handlers/` to expose the functionality

### Testing
- Unit tests are in `src/__tests__/`
- The project uses Jest for testing
- Run tests with `npm run test`

### Environment Setup
1. Create a `.env` file in the project root based on `.env.example`
2. Configure Nextcloud credentials (base URL, username, app token)
3. Set server configuration options (port, name, version)