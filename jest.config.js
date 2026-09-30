module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/app/**/*.spec.ts',
    '<rootDir>/app/**/*.test.ts'
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
