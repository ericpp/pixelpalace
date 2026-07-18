<script>
	import './styles.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getAlbyServer, user, albyReady, userReady, loaded } from '$/stores';
	import { setupBitcoinConnect } from '$lib/bitcoinConnect';

	onMount(async () => {
		await setupBitcoinConnect();
		await loadAlby();
	});

	async function loadAlby() {
		const code = $page.url.searchParams.get('code');
		if (code) {
			const redirect_uri = $page.url.href.split('/?')[0].split('?')[0];

			const res = await fetch(
				getAlbyServer() + '/api/alby/auth?code=' + code + '&redirect_uri=' + redirect_uri,
				{
					credentials: 'include'
				}
			);
			const data = await res.json();
			if (data.lightning_address) {
				$user.loggedIn = true;
				$user.name = data.lightning_address;
				$user.balance = data.balance;
				$albyReady = true;
				$userReady = true;
			}
			const urlWithoutQuery = window.location.href.split('?')[0];
			window.history.replaceState(null, null, urlWithoutQuery);
		} else {
			// Anonymous QR/Venmo path — skip auto Alby refresh
			$albyReady = true;
		}
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
