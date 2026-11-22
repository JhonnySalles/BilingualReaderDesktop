module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Limita a 5-6 workers concorrentes e recicla processos ociosos para garantir
  // que o consumo total fique estritamente abaixo do teto de 10 GB.
  maxWorkers: 6,
  workerIdleMemoryLimit: '1.2GB',
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
