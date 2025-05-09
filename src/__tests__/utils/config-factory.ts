/**
 * Factory for creating test configurations
 */
import { NextcloudConfig } from '../../config/config.js';

/**
 * Factory for creating configuration objects for tests
 */
export class ConfigFactory {
  /**
   * Create a Nextcloud configuration with default test values
   * @param overrides Properties to override defaults
   * @returns A NextcloudConfig instance
   */
  static createNextcloudConfig(overrides: Partial<NextcloudConfig> = {}): NextcloudConfig {
    const defaults: NextcloudConfig = {
      baseUrl: 'https://nextcloud.example.com',
      username: 'testuser',
      appToken: 'test-token',
    };

    return { ...defaults, ...overrides };
  }
}
