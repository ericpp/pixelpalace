import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import path from 'node:path';

function liveWebSocketPlugin() {
	const attach = async (server: ViteDevServer) => {
		try {
			const mod = (await server.ssrLoadModule('$lib/server/live/ws')) as {
				attachLiveWebSocket: (httpServer: ViteDevServer['httpServer']) => void;
			};
			mod.attachLiveWebSocket(server.httpServer);
		} catch (err) {
			console.error('live websocket attach failed:', err);
		}
	};

	return {
		name: 'live-websocket',
		configureServer(server: ViteDevServer) {
			if (server.httpServer?.listening) {
				void attach(server);
				return;
			}
			server.httpServer?.once('listening', () => {
				void attach(server);
			});
		}
	};
}

const dockerDev = process.env.DOCKER_DEV === 'true';
const port = Number(process.env.PORT) || (dockerDev ? 3000 : 3001);

export default defineConfig({
	plugins: [sveltekit(), liveWebSocketPlugin()],
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
		host: true,
		port,
		strictPort: dockerDev,
		watch: {
			ignored: ['**/.vercel/**', '**/.git/**'],
			usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
			interval: 300
		},
		hmr: dockerDev
			? {
					host: 'localhost',
					port,
					clientPort: port
				}
			: undefined
	},
	preview: {
		port: 3001
	}
});
