# Development Commands

## Build and Run
- `npm run build` - Build the project
- `npm run start` - Run the built application
- `npm run dev` - Run in development mode

## Testing and Code Quality
- `npm run test` - Run tests
- `npm run lint` - Run ESLint for static code analysis
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting without modifying files

## MCP Tool Registration
To add new functionality, register tools with the MCP server in `src/index.ts`:

```typescript
server.registerTool({
  name: 'toolName',
  description: 'Description of what the tool does',
  parameters: {
    // Define parameters here
  },
  execute: async (params) => {
    // Implementation goes here
  }
});
```

## Logging
The application uses a structured logging system with multiple log levels:

```typescript
import { createLogger } from './services/logger.js';

// Create a logger for your component
const logger = createLogger('ComponentName');

// Log at different levels
logger.debug('Detailed debugging information');
logger.info('General information');
logger.warn('Warning conditions');
logger.error('Error conditions');
```

Set the LOG_LEVEL environment variable to control verbosity:
- DEBUG - Show all logs
- INFO - Show info, warn, and error logs (default)
- WARN - Show only warnings and errors
- ERROR - Show only errors