module.exports = {
    moduleNameMapper: {
        '@/(.*)$': '<rootDir>/src/$1',
    },
    setupFilesAfterEnv: ['<rootDir>/.jest/register-context.js', '<rootDir>/src/setupTests.js'],
    testEnvironment: '<rootDir>/.jest/jsdom-with-fetch-env.js',
    transform: {
        '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', {presets: ['next/babel']}],
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    reporters: [['summary', {summaryThreshold: 1}]],
};
