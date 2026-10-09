<script lang="ts">
	import BoostPage from './BoostPage.svelte';
	import Venmo from './Venmo.svelte';
	import PaymentSelector from './PaymentSelector.svelte';
	import type { Block, PaymentIntent, PaymentType } from '$lib/types';
	import { isNostrEventConfigured, nostrEvent, wallet } from '$/stores';
	import { lockEffectSlot } from '$lib/functions/sendEffectBoost';
	import { nostrEventHref } from '$lib/nostr/resolveEvent';

	export let broadcastingBlock: Block;
	export let throwConfetti: (amount: number) => void;
	export let isMobile = false;
	export let appearance: 'default' | 'headless' = 'default';
	export let showModal = false;
	export let paymentIntent: PaymentIntent = 'boost';
	export let presetAmount: number | undefined = undefined;
	export let presetMessage = '';
	export let effectId: string | undefined = undefined;
	export let onEffectSent: () => void = () => {};
	let paymentType: PaymentType | undefined;
	let modalWasOpen = false;
	let satAmount: number | undefined = undefined;
	let armedEffectId = '';

	$: if (showModal && !modalWasOpen) {
		paymentType = $wallet.connected ? 'wallet' : undefined;
		satAmount = undefined;
		armedEffectId = '';
		modalWasOpen = true;
	} else if (!showModal) {
		modalWasOpen = false;
		satAmount = undefined;
		armedEffectId = '';
	}

	// A persisted wallet can finish connecting after the modal opens. Only fill
	// the initial unset state so Change Payment Type (empty string) stays put.
	$: if (showModal && paymentType === undefined && $wallet.connected) {
		paymentType = 'wallet';
	}

	function attachSats(amount: number) {
		satAmount = amount;
		armedEffectId = effectId || '';
	}

	function onPaid(amount: number) {
		const id = armedEffectId;
		armedEffectId = '';
		throwConfetti(amount);
		if (!id) return;
		void lockEffectSlot(id).catch((err) => {
			console.error(err);
		});
	}

	const zapEnabled = isNostrEventConfigured();

	function openWithIntent(intent: PaymentIntent) {
		paymentIntent = intent;
		paymentType = undefined;
		showModal = true;
	}

	$: console.log(paymentType);
	$: console.log(showModal);
</script>

{#if appearance !== 'headless'}
<div class="container" class:has-zap={zapEnabled}>
	<button class="boost-btn boost" class:mobile={isMobile} on:click={() => openWithIntent('boost')}>
		Boost
	</button>
	{#if zapEnabled}
		<button class="boost-btn zap" class:mobile={isMobile} on:click={() => openWithIntent('zap')}>
			Zap
		</button>
	{/if}
</div>

{#if $nostrEvent}
	<p class="nostr-link">
		<a href={nostrEventHref($nostrEvent)} target="_blank" rel="noopener noreferrer">
			Zaps go to {$nostrEvent.title}
		</a>
	</p>
{/if}
{/if}

{#if showModal}
	{#if effectId && satAmount == null}
		<BoostPage
			effectMode
			{effectId}
			bind:showModal
			{broadcastingBlock}
			paymentType=""
			throwConfetti={onPaid}
			{isMobile}
			{paymentIntent}
			{presetMessage}
			onAttachSats={attachSats}
			{onEffectSent}
		/>
	{:else if !paymentType}
		<PaymentSelector bind:paymentType bind:showModal {paymentIntent} />
	{:else if paymentType === 'venmo'}
		<Venmo bind:showModal bind:paymentType />
	{:else}
		<BoostPage
			bind:showModal
			{broadcastingBlock}
			bind:paymentType
			throwConfetti={onPaid}
			{isMobile}
			{paymentIntent}
			presetAmount={satAmount ?? presetAmount}
			{presetMessage}
		/>
	{/if}
{/if}

<style>
	.container {
		display: flex;
		flex-direction: row;
		justify-content: space-around;
		align-items: center;
		width: 100%;
		padding: 1rem;
		gap: 1rem;
		box-sizing: border-box;
		overflow: hidden;
	}

	.boost-btn {
		background: #f7931a;
		color: white;
		border: none;
		padding: 12px 24px;
		border-radius: 10px;
		font-size: 48px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.boost-btn:hover {
		background: #e8850f;
	}

	.zap {
		background: #8b5cf6;
	}

	.zap:hover {
		background: #7c3aed;
	}

	.has-zap .boost-btn {
		font-size: 36px;
		padding: 10px 18px;
	}

	.mobile {
		padding: 8px 18px;
		border-radius: 8px;
		font-size: 36px;
		font-weight: 500;
	}

	.has-zap .mobile {
		font-size: 28px;
		padding: 8px 14px;
	}

	.nostr-link {
		margin: 0 1rem 0.75rem;
		text-align: center;
		font-weight: 600;
	}

	.nostr-link a {
		color: #ddd6fe;
		text-decoration: underline;
	}
</style>
