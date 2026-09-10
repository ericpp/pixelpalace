import { browser } from '$app/environment';
import { getAppName, wallet } from '$/stores';
import type { WalletProvider } from '$lib/types';

let initialized = false;
let walletSessionLocked = false;
let connectedProvider: WalletProvider | null = null;
let modulePromise: Promise<typeof import('@getalby/bitcoin-connect')> | null = null;

function loadBitcoinConnect() {
	if (!browser) return null;
	if (!modulePromise) {
		modulePromise = import('@getalby/bitcoin-connect');
	}
	return modulePromise;
}

async function refreshWalletBalance(provider: WalletProvider): Promise<void> {
	wallet.update((state) => ({ ...state, connected: true, provider }));

	if (!provider?.getBalance) return;

	try {
		const { balance } = await provider.getBalance();
		wallet.update((state) => ({ ...state, connected: true, provider, balance }));
	} catch {
		// Balance unavailable; wallet is still connected.
	}
}

function setConnectedProvider(provider: WalletProvider | null): void {
	connectedProvider = provider;
	wallet.update((state) => ({ ...state, provider, connected: !!provider }));
}

export async function setupBitcoinConnect(): Promise<void> {
	if (!browser || initialized) return;

	const bc = await loadBitcoinConnect();
	if (!bc) return;

	bc.init({
		appName: getAppName(),
		persistConnection: true,
		filters: ['nwc']
	});

	bc.onConnected((provider) => {
		if (walletSessionLocked && connectedProvider) {
			return;
		}
		setConnectedProvider(provider as WalletProvider);
		refreshWalletBalance(provider as WalletProvider);
	});

	initialized = true;
}

/** Open Bitcoin Connect and wait for an NWC wallet before continuing. */
export async function connectWallet(): Promise<WalletProvider> {
	if (!browser) {
		throw new Error('Wallet connection requires a browser');
	}

	await setupBitcoinConnect();
	const bc = await loadBitcoinConnect();
	if (!bc) {
		throw new Error('Wallet connection requires a browser');
	}

	// Keep an already-linked NWC session when returning via Change Payment Type.
	if (connectedProvider) {
		walletSessionLocked = true;
		await refreshWalletBalance(connectedProvider);
		return connectedProvider;
	}

	const existingConfig = bc.getConnectorConfig?.();
	const isNwc =
		typeof existingConfig?.connectorType === 'string' &&
		existingConfig.connectorType.startsWith('nwc');
	// Drop non-NWC auto-connect (e.g. extension) so wallet boosts stay on NWC.
	// Do not disconnect a persisted NWC link — requestProvider will restore it.
	if (existingConfig && !isNwc) {
		bc.disconnect();
		walletSessionLocked = false;
		setConnectedProvider(null);
	}

	const provider = (await bc.requestProvider()) as WalletProvider;
	walletSessionLocked = true;
	setConnectedProvider(provider);
	await refreshWalletBalance(provider);
	return provider;
}

export function getConnectedProvider(): WalletProvider | null {
	return connectedProvider;
}

export function releaseWalletSession(): void {
	walletSessionLocked = false;
}

export async function disconnectWallet(): Promise<void> {
	if (!browser) return;

	await setupBitcoinConnect();
	const bc = await loadBitcoinConnect();
	bc?.disconnect?.();

	walletSessionLocked = false;
	connectedProvider = null;
	wallet.set({ connected: false, balance: null, provider: null });
}

export async function refreshConnectedWalletBalance(): Promise<void> {
	if (!connectedProvider) return;
	await refreshWalletBalance(connectedProvider);
}
