module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/back/**/*.spec.ts',
    '<rootDir>/test/back/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    'app/services/ebook-convert/smoke',
    'app/services/ebook-convert/epub-packer'
  ],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.electron.json'
    }]
  },
  verbose: true
};
