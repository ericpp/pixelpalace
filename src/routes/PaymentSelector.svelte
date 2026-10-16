<script lang="ts">
	import Modal from './Modal.svelte';
	import type { PaymentIntent, PaymentType } from '$lib/types';

	export let showModal: boolean;
	export let paymentType: PaymentType | undefined;
	export let paymentIntent: PaymentIntent = 'boost';

	import { page } from '$app/stores';

	import {
		getAlbyRedirectUri,
		getPayPalUrl,
		isAlbyEnabled,
		isPayPalEnabled,
		isVenmoEnabled,
		user,
		wallet
	} from '$/stores';
	import { startAlbyLogin } from '$lib/albyOAuth';
	import { connectWallet } from '$lib/bitcoinConnect';

	let connectingWallet = false;

	const albyEnabled = isAlbyEnabled();
	const venmoEnabled = isVenmoEnabled();
	const paypalEnabled = isPayPalEnabled();
	$: redirectUri = getAlbyRedirectUri($page.url);

	function openPayPal() {
		window.open(getPayPalUrl(), '_blank', 'noopener,noreferrer');
	}

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
		<h1>How would you like to {paymentIntent === 'zap' ? 'zap' : 'boost'}?</h1>
		<p class="intent-note">
			{#if paymentIntent === 'zap'}
				Zaps go to the linked Nostr event
			{:else}
				Boosts go to the current Split Kit block
			{/if}
		</p>

		<div class="buttons">
			<button disabled={connectingWallet} on:click={handleWalletClick}>
				{connectingWallet ? 'Connecting…' : 'Wallet'}
			</button>
			{#if albyEnabled}
				<button
					on:click={() => {
						if ($user.loggedIn) {
							paymentType = 'alby';
						} else {
							startAlbyLogin(redirectUri);
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
			{#if paymentIntent !== 'zap' && venmoEnabled}
				<button
					on:click={() => {
						paymentType = 'venmo';
					}}
				>
					Venmo
				</button>
			{/if}
			{#if paymentIntent !== 'zap' && paypalEnabled}
				<button on:click={openPayPal}>PayPal</button>
			{/if}
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

	.intent-note {
		margin: 0 24px 16px;
		text-align: center;
		color: rgba(255, 255, 255, 0.8);
		font-weight: 600;
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
