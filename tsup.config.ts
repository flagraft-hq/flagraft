import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts', 'src/cli/create-root-key.ts', 'src/db/migrate.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  splitting: false,
})
