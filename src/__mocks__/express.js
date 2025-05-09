// Mock Express
import { jest } from '@jest/globals';

const mockExpressApp = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  all: jest.fn(),
  listen: jest.fn().mockImplementation((port, callback) => {
    if (callback) callback();
    return {
      close: jest.fn().mockImplementation(cb => cb && cb()),
    };
  }),
};

const express = jest.fn(() => mockExpressApp);
express.json = jest.fn(() => jest.fn());
express.urlencoded = jest.fn(() => jest.fn());
express.static = jest.fn();

export default express;