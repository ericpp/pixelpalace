import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, process.cwd(), 'PUBLIC_');
	// Proxy is only used by vite dev/preview. Production (adapter-node) reads
	// PUBLIC_* from the process environment at runtime via $env/dynamic/public.
	const skTarget = env.PUBLIC_EVENT_HOST?.replace(/\/$/, '');
	if (command === 'serve' && !skTarget) {
		throw new Error('PUBLIC_EVENT_HOST is required in .env');
	}

	const proxy = skTarget
		? {
				'/api/sk': {
					target: skTarget,
					changeOrigin: true,
					secure: true
				}
			}
		: undefined;

	return {
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
			port: 3001,
			proxy
		},
		preview: {
			port: 3001,
			proxy
		}
	};
});
