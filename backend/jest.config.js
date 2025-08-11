/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  // Increase default timeout for potentially slower environments
  testTimeout: 20000,
};
