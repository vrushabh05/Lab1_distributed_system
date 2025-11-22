export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'validation/**/*.js'
  ],
  coverageThreshold: {
    'validation/**/*.js': {
      branches: 0,
      functions: 0,
      lines: 20,
      statements: 19
    }
  },
  injectGlobals: true
};
