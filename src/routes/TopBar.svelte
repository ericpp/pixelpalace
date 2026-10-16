<script lang="ts">
	import { page } from '$app/stores';
	import { connectWallet, disconnectWallet } from '$lib/bitcoinConnect';
	import { startAlbyLogin } from '$lib/albyOAuth';
	import { logoutAlby } from '$lib/functions/refreshAlbyToken';
	import { getAlbyRedirectUri, getAppName, isAlbyEnabled, user, wallet } from '$/stores';

	export let nowPlaying: string | undefined = undefined;
	export let onHowTo: () => void = () => {};

	const appName = getAppName();
	const albyEnabled = isAlbyEnabled();

	let connecting = false;
	let menuOpen = false;
	let connectMenuOpen = false;
	let walletControl: HTMLElement;

	$: anyConnected = $wallet.connected || $user.loggedIn;
	$: satBalance = $wallet.connected
		? Math.floor($wallet.balance ?? 0)
		: Math.floor($user.balance ?? 0);

	async function handleConnect() {
		connectMenuOpen = false;
		connecting = true;
		try {
			await connectWallet();
		} catch (err) {
			console.log(err);
		} finally {
			connecting = false;
		}
	}

	async function handleDisconnect() {
		menuOpen = false;
		await disconnectWallet();
	}

	async function handleAlbyDisconnect() {
		menuOpen = false;
		await logoutAlby();
	}

	async function handleAlbyConnect() {
		connectMenuOpen = false;
		await startAlbyLogin(getAlbyRedirectUri($page.url));
	}

	function handleWindowClick(event: MouseEvent) {
		if (
			(menuOpen || connectMenuOpen) &&
			walletControl &&
			!walletControl.contains(event.target as Node)
		) {
			menuOpen = false;
			connectMenuOpen = false;
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<header class="topbar">
	<div class="title">
		<span class="app-name">{appName}</span>
		{#if nowPlaying}
			<span class="now-playing">
				<span class="label">Now playing</span>
				<span class="song">{nowPlaying}</span>
			</span>
		{/if}
	</div>

	<div class="actions">
		<div class="wallet" bind:this={walletControl}>
			{#if anyConnected}
				<button
					class="chip sats"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					on:click={() => (menuOpen = !menuOpen)}
				>
					⚡ {satBalance.toLocaleString()} {satBalance === 1 ? 'sat' : 'sats'} ▾
				</button>
				{#if menuOpen}
					<div class="menu" role="menu">
						{#if $wallet.connected}
							<button role="menuitem" on:click={handleDisconnect}>
								{$user.loggedIn ? 'Disconnect NWC wallet' : 'Disconnect wallet'}
							</button>
						{/if}
						{#if $user.loggedIn}
							<button role="menuitem" on:click={handleAlbyDisconnect}>
								{$wallet.connected ? 'Disconnect Alby' : 'Disconnect wallet'}
							</button>
						{/if}
					</div>
				{/if}
			{:else}
				<button
					class="connect"
					disabled={connecting}
					aria-haspopup="menu"
					aria-expanded={connectMenuOpen}
					on:click={() => (connectMenuOpen = !connectMenuOpen)}
				>
					{connecting ? 'Connecting…' : 'Connect Wallet ▾'}
				</button>
				{#if connectMenuOpen}
					<div class="menu" role="menu">
						<button role="menuitem" on:click={handleConnect}>Connect NWC wallet</button>
						{#if albyEnabled && !$user.loggedIn}
							<button role="menuitem" on:click={handleAlbyConnect}>Connect Alby wallet</button>
						{/if}
					</div>
				{/if}
			{/if}
		</div>

		<button class="how-to" on:click={onHowTo}>How to Play</button>
	</div>
</header>

<style>
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		height: 32px;
		padding: 0 4px;
		box-sizing: border-box;
		color: rgba(255, 255, 255, 0.85);
		font-family: 1rem;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
	}

	.title {
		display: flex;
		align-items: baseline;
		gap: 14px;
		min-width: 0;
	}

	.app-name {
		flex-shrink: 0;
		font-size: 1rem;
		font-weight: 700;
	}

	.now-playing {
		display: flex;
		align-items: baseline;
		gap: 6px;
		min-width: 0;
		font-size: 0.875rem;
	}

	.label {
		flex-shrink: 0;
		text-transform: uppercase;
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: rgba(255, 255, 255, 0.55);
	}

	.song {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: rgba(255, 255, 255, 0.75);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.chip,
	.connect,
	.how-to {
		height: 26px;
		margin: 0;
		padding: 0 10px;
		display: inline-flex;
		align-items: center;
		box-sizing: border-box;
		border-radius: 13px;
		border: 1px solid transparent;
		background: transparent;
		box-shadow: none;
		color: inherit;
		font-family: inherit;
		font-size: 1rem;
		font-weight: 600;
		text-shadow: inherit;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	button.chip,
	.connect,
	.how-to {
		cursor: pointer;
	}

	.connect,
	.how-to {
		border-color: rgba(255, 255, 255, 0.3);
	}

	button.chip:hover,
	.connect:hover,
	.how-to:hover {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}

	.connect:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.chip:focus-visible,
	.connect:focus-visible,
	.how-to:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}

	.wallet {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.menu {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 20;
		min-width: 210px;
		padding: 6px;
		background: rgba(20, 20, 24, 0.95);
		border-radius: 10px;
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
	}

	.menu button {
		width: 100%;
		margin: 0;
		padding: 8px 10px;
		background: transparent;
		border: none;
		box-shadow: none;
		border-radius: 6px;
		color: #fff;
		font-family: inherit;
		font-size: 1rem;
		font-weight: 600;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}

	.menu button:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	@media (max-width: 995px) {
		.topbar {
			height: auto;
			flex-wrap: wrap;
			align-items: flex-start;
			gap: 8px;
			padding: 4px 0 2px;
		}

		.title {
			flex: 1 1 140px;
			gap: 8px;
		}

		.app-name,
		.now-playing,
		.label {
			font-size: 0.8rem;
		}

		.label {
			display: none;
		}

		.actions {
			flex-wrap: wrap;
			justify-content: flex-end;
			gap: 6px;
		}

		.chip,
		.connect,
		.how-to {
			height: 28px;
			padding: 0 8px;
			font-size: 0.8rem;
		}
	}

	@media (max-width: 480px) {
		.now-playing {
			display: none;
		}
	}
</style>
