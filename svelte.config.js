import vercelAdapter from '@sveltejs/adapter-vercel';
import nodeAdapter from '@sveltejs/adapter-node';

const useNodeAdapter = process.env.ADAPTER === 'node';
const adapter = useNodeAdapter ? nodeAdapter : vercelAdapter;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		alias: {
			$: 'src',
			$functions: 'src/lib/functions',
			$icons: 'src/lib/icons',
			$routes: 'src/routes'
		}
	}
};

export default config;
