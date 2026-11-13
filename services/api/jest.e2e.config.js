module.exports = {
  rootDir: '../..',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/e2e/**/*.spec.ts'],
  moduleDirectories: ['node_modules', '<rootDir>/services/api/node_modules'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/services/api/tsconfig.json', diagnostics: false }],
  },
};
