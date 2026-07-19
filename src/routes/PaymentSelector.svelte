<script>
	import Modal from './Modal.svelte';

	export let showModal;
	export let paymentType;

	import { page } from '$app/stores';

	import { getAlbyOAuthUrl, getAlbyRedirectUri, isAlbyEnabled, user, wallet } from '$/stores';
	import { storeAlbyRedirectUri } from '$lib/albyOAuth';
	import { connectWallet } from '$lib/bitcoinConnect';

	let connectingWallet = false;

	const albyEnabled = isAlbyEnabled();
	$: redirectUri = getAlbyRedirectUri($page.url);
	$: redirectUrl = albyEnabled ? getAlbyOAuthUrl(redirectUri) : '';

	async function handleWalletClick() {
		if ($wallet.connected) {
			paymentType = 'wallet';
			return;
		}

		connectingWallet = true;
		try {
			await connectWallet();
			paymentType = 'wallet';
		} catch (err) {
			console.log(err);
		} finally {
			connectingWallet = false;
		}
	}
</script>

<Modal bind:showModal>
	<boost-container>
		<h1>How would you like to boost?</h1>

		<div class="buttons">
			{#if albyEnabled}
				<button
					on:click={() => {
						if ($user.loggedIn) {
							paymentType = 'alby';
						} else {
							storeAlbyRedirectUri(redirectUri);
							window.location.href = redirectUrl;
						}
					}}
				>
					Alby
				</button>
			{/if}
			<button
				on:click={() => {
					paymentType = 'qr';
				}}
			>
				Scan QR Code
			</button>
			<button disabled={connectingWallet} on:click={handleWalletClick}>
				{connectingWallet ? 'Connecting…' : 'Wallet'}
			</button>
			<button
				on:click={() => {
					paymentType = 'venmo';
				}}
			>
				Venmo
			</button>
		</div>
	</boost-container>
</Modal>

<style>
	boost-container {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: #222;
	}

	h1 {
		text-align: center;
		color: white;
	}

	button {
		font-size: 1em;
		cursor: pointer;
		margin: 8px;
		height: 50px;
		box-shadow: none;
		width: 180px;
		background: #f7931a;
		color: white;
		border: none;
		padding: 12px 24px;
		border-radius: 10px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	button:hover {
		background: #e8850f;
	}

	button:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.buttons {
		padding-bottom: 128px;
	}
	@media (max-width: 410px) {
		boost-container {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: flex-start;
			color: #222;
		}
	}
</style>
