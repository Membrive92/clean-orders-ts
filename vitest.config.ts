import { defineConfig } from 'vitest/config';
import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts',  'src/**/*.spec.ts'],
    globals: true,
  },
 resolve: {
    alias: {
      '@domain': resolve(__dirname,'./src/domain'),
      '@application': resolve(__dirname,'./src/application'),
      '@infrastructure': resolve(__dirname,'./src/infrastructure'),
      '@composition': resolve(__dirname,'./src/composition'),
      '@shared': resolve(__dirname,'./src/shared'),
    },
  },
});
