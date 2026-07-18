import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			$functions: path.resolve('src', 'lib', 'functions'),
			$: path.resolve('src'),
			$icons: path.resolve('src', 'lib', 'icons'),
			$lib: path.resolve('src', 'lib'),
			$routes: path.resolve('src', 'routes')
		}
	},
	server: {
		port: 3001
	},
	preview: {
		port: 3001
	}
});
