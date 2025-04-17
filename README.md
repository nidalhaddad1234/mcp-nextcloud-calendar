# MCP Nextcloud Calendar

A Model Context Protocol (MCP) server for Nextcloud Calendar integration.

## Features

- Fetch calendars from Nextcloud
- ADHD-friendly organization features
- MCP protocol support

## Setup

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Configuration

This project uses environment variables for configuration. You can set them up in two ways:

1. Create a `.env` file in the project root (copy from `.env.example`):

```bash
cp .env.example .env
```

2. Edit the `.env` file with your Nextcloud credentials:

```
# Server configuration
PORT=3001
SERVER_NAME=nextcloud-calendar-server
SERVER_VERSION=1.0.0
NODE_ENV=development

# Nextcloud configuration
NEXTCLOUD_BASE_URL=https://your-nextcloud-server.com
NEXTCLOUD_USERNAME=your-username
NEXTCLOUD_APP_TOKEN=your-app-token
```

### Getting a Nextcloud App Token

1. Log in to your Nextcloud instance
2. Go to Settings → Security → App Passwords
3. Create a new app password with a name like "MCP Calendar"
4. Copy the generated token to your `.env` file

## Development

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm run test

# Run linting
npm run lint

# Format code
npm run format
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/calendars` - List all calendars

## License

ISC