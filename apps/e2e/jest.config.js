/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
};
