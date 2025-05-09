import express from 'express';
type Request = express.Request;
type Response = express.Response;
import { ServerConfig } from '../config/config.js';

export function healthHandler(config: ServerConfig) {
  return (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      server: config.serverName,
      version: config.serverVersion,
      environment: config.environment,
      timestamp: new Date().toISOString(),
    });
  };
}
