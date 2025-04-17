import { config } from 'dotenv';

// Load environment variables from .env file
config();

export interface ServerConfig {
  port: number;
  serverName: string;
  serverVersion: string;
  environment: string;
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
};

export function loadConfig(): { server: ServerConfig; nextcloud: NextcloudConfig } {
  return {
    server: {
      port: parseInt(process.env.PORT || String(defaultConfig.port)),
      serverName: process.env.SERVER_NAME || defaultConfig.serverName,
      serverVersion: process.env.SERVER_VERSION || defaultConfig.serverVersion,
      environment: process.env.NODE_ENV || defaultConfig.environment,
    },
    nextcloud: {
      baseUrl: process.env.NEXTCLOUD_BASE_URL || '',
      username: process.env.NEXTCLOUD_USERNAME || '',
      appToken: process.env.NEXTCLOUD_APP_TOKEN || '',
    }
  };
}
