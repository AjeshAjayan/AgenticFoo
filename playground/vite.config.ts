import { defineConfig } from 'vite';

export default defineConfig({
    // Load .env files from the project root instead of playground/
    envDir: '..',
});
