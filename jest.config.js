export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  setupFilesAfterEnv: ['./jest.setup.js', './jest-setup.test.js'],
  maxWorkers: 1,  // Run tests serially to avoid concurrency issues
  forceExit: true, // Force Jest to exit after all tests are complete
  
  // Only consider files with test or spec in their name as test files
  testMatch: ['**/__tests__/**/*.(test|spec).[jt]s?(x)'],

  // Make sure these directories are not treated as containing tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/utils/',
    '/__tests__/example-calendar-service.test.ts',
    '/__tests__/calendar-service-simple.test.ts',
    '/__tests__/integration/calendar-integration.test.ts',
    'build/__tests__/example-calendar-service.test.js',
    'build/__tests__/calendar-service-simple.test.js',
    'build/__tests__/integration/calendar-integration.test.js'
  ]
};