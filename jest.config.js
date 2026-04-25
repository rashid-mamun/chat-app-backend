module.exports = {
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/tests/**',
        '!src/**/*.test.js',
        '!src/**/*.spec.js',
        '!src/__mocks__/**'
    ],
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },
    testTimeout: 60000,
    verbose: true,
    forceExit: true,
    // Redirect all redis config imports to our in-memory mock (no real Redis needed)
    moduleNameMapper: {
        '^.*/config/redis$': '<rootDir>/src/__mocks__/config/redis.js'
    }
};