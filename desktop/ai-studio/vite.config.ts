import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const root = path.resolve(__dirname);

export default defineConfig({
  plugins: [
    svelte(),
    tailwindcss(),
    electron([
      {
        entry: path.join(root, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: path.join(root, 'dist/main'),
            rollupOptions: {
              external: ['better-sqlite3', 'electron', 'archiver', '@modelcontextprotocol/sdk'],
            },
          },
          resolve: {
            alias: {
              '@shared': path.join(root, 'src/shared'),
            },
          },
        },
      },
      {
        entry: path.join(root, 'src/main/preload.ts'),
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: path.join(root, 'dist/preload'),
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    electronRenderer(),
  ],
  resolve: {
    alias: {
      '@shared': path.join(root, 'src/shared'),
    },
  },
  root: path.join(root, 'src/renderer'),
  build: {
    outDir: path.join(root, 'dist/renderer'),
  },
});
