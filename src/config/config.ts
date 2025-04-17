export interface ServerConfig {
  port: number;
  serverName: string;
  serverVersion: string;
  environment: string;
}

const defaultConfig: ServerConfig = {
  port: 3001,
  serverName: 'nextcloud-calendar-server',
  serverVersion: '1.0.0',
  environment: 'development',
};

export function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || String(defaultConfig.port)),
    serverName: process.env.SERVER_NAME || defaultConfig.serverName,
    serverVersion: process.env.SERVER_VERSION || defaultConfig.serverVersion,
    environment: process.env.NODE_ENV || defaultConfig.environment,
  };
}
