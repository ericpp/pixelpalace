import { browser } from '$app/environment';
import { getAppName, wallet } from '$/stores';

let initialized = false;
let walletSessionLocked = false;
/** @type {import('@getalby/bitcoin-connect').WebLNProvider | null} */
let connectedProvider = null;
/** @type {Promise<typeof import('@getalby/bitcoin-connect')> | null} */
let modulePromise = null;

function loadBitcoinConnect() {
	if (!browser) return null;
	if (!modulePromise) {
		modulePromise = import('@getalby/bitcoin-connect');
	}
	return modulePromise;
}

async function refreshWalletBalance(provider) {
	wallet.update((state) => ({ ...state, connected: true, provider }));

	if (!provider?.getBalance) return;

	try {
		const { balance } = await provider.getBalance();
		wallet.update((state) => ({ ...state, connected: true, provider, balance }));
	} catch {
		// Balance unavailable; wallet is still connected.
	}
}

function setConnectedProvider(provider) {
	connectedProvider = provider;
	wallet.update((state) => ({ ...state, provider, connected: !!provider }));
}

export async function setupBitcoinConnect() {
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
		setConnectedProvider(provider);
		refreshWalletBalance(provider);
	});

	initialized = true;
}

/** Open Bitcoin Connect and wait for an NWC wallet before continuing. */
export async function connectWallet() {
	if (!browser) {
		throw new Error('Wallet connection requires a browser');
	}

	await setupBitcoinConnect();
	const bc = await loadBitcoinConnect();

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

	const provider = await bc.requestProvider();
	walletSessionLocked = true;
	setConnectedProvider(provider);
	await refreshWalletBalance(provider);
	return provider;
}

export function getConnectedProvider() {
	return connectedProvider;
}

export function releaseWalletSession() {
	walletSessionLocked = false;
}

export async function disconnectWallet() {
	if (!browser) return;

	await setupBitcoinConnect();
	const bc = await loadBitcoinConnect();
	bc?.disconnect?.();

	walletSessionLocked = false;
	connectedProvider = null;
	wallet.set({ connected: false, balance: null, provider: null });
}

export async function refreshConnectedWalletBalance() {
	if (!connectedProvider) return;
	await refreshWalletBalance(connectedProvider);
}
