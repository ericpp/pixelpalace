export type PaymentType = 'alby' | 'wallet' | 'qr' | 'venmo' | '';

export type PaymentIntent = 'boost' | 'zap';

export type SplitStatus = 'success' | 'failed' | 'pending';

export interface Destination {
	name?: string;
	address: string;
	type?: string;
	split: string | number;
	fee?: boolean;
	customKey?: string | number;
	customValue?: string;
	destIndex?: number;
}

export interface Block {
	title?: string;
	feedGuid?: string;
	itemGuid?: string;
	eventGuid?: string;
	blockGuid?: string;
	eventAPI?: string;
	image?: string;
	artwork?: string;
	value?: {
		destinations?: Destination[];
	};
}

export interface MainSettings {
	splits?: number;
	broadcastMode?: string;
	editEnclosure?: string;
	broadcastDelay?: number;
	boostBoard?: string;
	liveChatEnclosure?: string;
	liveBackgroundUrl?: string;
	liveEnclosure?: string;
	liveStreamType?: string;
}

export interface UserState {
	loggedIn: boolean;
	name?: string;
	balance?: number;
}

export interface EffectSlotState {
	id: string;
	unlocked: boolean;
	remainingMs: number;
}

export interface FiredEffect {
	id: string;
	label: string;
	senderName: string;
	message: string;
}

export interface WalletProvider {
	getBalance?: () => Promise<{ balance: number }>;
	keysend?: (params: {
		destination: string;
		amount: number;
		customRecords?: Record<string, string>;
	}) => Promise<unknown>;
	sendPayment: (invoice: string) => Promise<unknown>;
}

export interface WalletState {
	connected: boolean;
	balance: number | null;
	provider: WalletProvider | null;
}

export interface BoostPayment {
	type?: string;
	destination: string;
	amount: number;
	customRecords: Record<string, string>;
	name?: string;
	destIndex?: number;
}

export interface BuildBoostPaymentsArgs {
	block: Block;
	satAmount: number;
	boostagram: string;
	senderName: string;
	isDefault?: boolean;
}

export interface PaymentResult {
	destIndex?: number;
	destination?: string;
	name?: string;
	status: SplitStatus;
	error?: unknown;
}

export interface PaymentAttemptResult {
	success?: boolean;
	status?: string;
	recipient: BoostPayment;
	paymentData?: unknown;
	err?: string;
}

export interface AlbyTokenData {
	access_token: string;
	refresh_token?: string;
	token_type?: string;
	expires_in?: number;
	scope?: string;
}

export interface AlbyUser {
	lightning_address?: string;
	balance?: number;
	[key: string]: unknown;
}

export interface LnurlInvoiceResponse {
	pr?: string;
	[key: string]: unknown;
}

export interface ResolvedNostrEvent {
	pointer: string;
	bech32: string;
	eventId: string;
	pubkey: string;
	kind: number;
	address?: string;
	relays: string[];
	title: string;
	tags: string[][];
	loaded: boolean;
}
