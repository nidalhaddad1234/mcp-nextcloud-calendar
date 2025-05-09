import { config } from 'dotenv';

// Load environment variables from .env file
config();

export interface ServerConfig {
  port: number;
  serverName: string;
  serverVersion: string;
  environment: string;
  keepAliveInterval: number; // Added keep-alive interval
}

export interface NextcloudConfig {
  baseUrl: string;
  username: string;
  appToken: string;
}

const defaultConfig: ServerConfig = {
  port: 3001,
  serverName: 'nextcloud-calendar-server',
  serverVersion: '1.0.0',
  environment: 'development',
  keepAliveInterval: 30000, // Default: 30 seconds
};

export function loadConfig(): { server: ServerConfig; nextcloud: NextcloudConfig } {
  // Check command line args for port override
  const args = process.argv.slice(2);
  let portOverride: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      const portValue = parseInt(args[i + 1]);
      if (!isNaN(portValue)) {
        portOverride = portValue;
      }
    }
  }

  return {
    server: {
      port: portOverride || parseInt(process.env.PORT || String(defaultConfig.port)),
      serverName: process.env.SERVER_NAME || defaultConfig.serverName,
      serverVersion: process.env.SERVER_VERSION || defaultConfig.serverVersion,
      environment: process.env.NODE_ENV || defaultConfig.environment,
      keepAliveInterval: process.env.KEEP_ALIVE_INTERVAL
        ? parseInt(process.env.KEEP_ALIVE_INTERVAL)
        : defaultConfig.keepAliveInterval,
    },
    nextcloud: {
      baseUrl: process.env.NEXTCLOUD_BASE_URL || '',
      username: process.env.NEXTCLOUD_USERNAME || '',
      appToken: process.env.NEXTCLOUD_APP_TOKEN || '',
    },
  };
}
