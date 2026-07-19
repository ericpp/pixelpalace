<script>
	import './styles.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getAlbyServer, getAlbyRedirectUri, isAlbyEnabled, user, albyReady, userReady, loaded } from '$/stores';
	import { setupBitcoinConnect } from '$lib/bitcoinConnect';
	import { applyAlbyUser } from '$lib/functions/refreshAlbyToken';
	import {
		claimAlbyCode,
		consumeAlbyRedirectUri,
		consumeAlbyCodeVerifier
	} from '$lib/albyOAuth';

	onMount(async () => {
		await setupBitcoinConnect();
		await loadAlby();
	});

	async function loadAlby() {
		if (!isAlbyEnabled()) {
			$albyReady = true;
			$loaded = true;
			return;
		}

		const code = $page.url.searchParams.get('code');
		if (code) {
			window.history.replaceState(null, '', window.location.pathname);

			if (claimAlbyCode(code)) {
				const redirect_uri = consumeAlbyRedirectUri(getAlbyRedirectUri($page.url));
				const code_verifier = consumeAlbyCodeVerifier();
				const params = new URLSearchParams({ code, redirect_uri });
				if (code_verifier) {
					params.set('code_verifier', code_verifier);
				}
				const res = await fetch(getAlbyServer() + '/api/alby/auth?' + params.toString(), {
					credentials: 'include'
				});
				const data = await res.json();
				if (applyAlbyUser(data)) {
					$albyReady = true;
					$userReady = true;
					$loaded = true;
					return;
				}
			}
		}

		const res = await fetch(getAlbyServer() + '/api/alby/refresh', {
			credentials: 'include'
		});
		const data = await res.json();
		if (applyAlbyUser(data)) {
			$userReady = true;
		}
		$albyReady = true;
		$loaded = true;
	}
</script>

<div class="app">
	<main>
		<slot />
	</main>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		width: 100%;
		margin: 0;
		box-sizing: border-box;
		overflow: hidden;
		height: 100%;
		position: relative;
	}
</style>
