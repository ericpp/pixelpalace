<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from './Modal.svelte';
	import QR from './QR.svelte';
	import SplitList from './SplitList.svelte';
	import { connectEventSocket } from '$lib/socket';

	import { user, wallet, getEventGuid, getEventSocketUrl, fetchLnurlInvoice, getBtcPriceUrl, nostrEvent } from '$/stores';
	import type { Block, PaymentIntent, PaymentType, SplitStatus } from '$lib/types';

	export let showModal: boolean;
	export let broadcastingBlock: Block;
	export let paymentType: PaymentType;
	export let isMobile = false;
	export let throwConfetti: (amount: number) => void;
	export let paymentIntent: PaymentIntent = 'boost';
	export let presetAmount: number | undefined = undefined;
	export let presetMessage = '';
	export let effectMode = false;
	export let effectId = '';
	export let onAttachSats: (amount: number) => void = () => {};
	export let onEffectSent: () => void = () => {};

	import sendBoost from '$lib/functions/sendBoost';
	import sendBoostWallet from '$lib/functions/sendBoostWallet';
	import sendEffectBoost from '$lib/functions/sendEffectBoost';
	import { sendZapAlby, sendZapWallet } from '$lib/functions/sendZap';
	import refreshAlbyToken from '$lib/functions/refreshAlbyToken';
	import { getConnectedProvider, refreshConnectedWalletBalance } from '$lib/bitcoinConnect';
	import { canZapEvent } from '$lib/nostr/resolveEvent';
	import { createZapInvoices, getZapSplitRecipients, type ZapInvoice } from '$lib/nostr/zap';
	import { EFFECT_ICONS, EFFECT_LABELS, isEffectId } from '$lib/effects';

	let senderName = effectMode ? '' : 'anonymous';
	let boostagram = presetMessage;
	let fromIndex = true;
	let amount = effectMode ? 0 : presetAmount && presetAmount >= 1 ? Math.floor(presetAmount) : 1;
	$: amountLocked = !effectMode && presetAmount != null && presetAmount >= 1;
	let btcPrice = 250000;
	let showQR = false;
	let invoice: string | undefined;
	let activeScreen: 'boost' | 'splits' = 'boost';
	let paying = false;
	let payError = '';
	let showExtras = false;
	let splitStatuses: Record<number, SplitStatus> = {};
	let zapInvoices: ZapInvoice[] = [];
	let qrInvoiceIndex = 0;
	$: console.log(broadcastingBlock);
	$: isZap = paymentIntent === 'zap';
	$: effectIcon = isEffectId(effectId) ? EFFECT_ICONS[effectId] : '';
	$: effectLabel = isEffectId(effectId) ? EFFECT_LABELS[effectId] : 'Item';
	$: zapSplits = isZap && $nostrEvent ? getZapSplitRecipients($nostrEvent, amount) : [];
	$: splitRows = isZap ? zapSplits : broadcastingBlock.value?.destinations || [];
	$: canPayZap = canZapEvent($nostrEvent);

	onMount(() => {
		fetchConversionRate();
		const storedName = localStorage.getItem('senderName') || '';
		senderName = effectMode
			? storedName === 'anonymous'
				? ''
				: storedName
			: storedName || 'anonymous';

		const url = getEventSocketUrl(broadcastingBlock.eventGuid || getEventGuid());
		const socketPromise = connectEventSocket(url);

		socketPromise.then((socket) => {
			socket.on('connect', () => {
				console.log(broadcastingBlock.eventGuid);
				console.log('Connected with clientId:', socket.id);
			});

			socket.on('invoiceVerify', function (data: string) {
				console.log('dude');
				console.log(data);

				if (invoice === data) {
					throwConfetti(amount);
					boostagram = '';
					showQR = false;
					showModal = false;
				}
			});
		});

		return () => {
			socketPromise.then((socket) => socket.disconnect());
		};
	});

	async function fetchConversionRate() {
		let res = await fetch(getBtcPriceUrl());

		btcPrice = Number(await res.text()) || 250000;
	}

	function satsToDollars(satAmount: number): string {
		const dollars = btcPrice * 10000;
		const usd = Math.round((satAmount / dollars) * 100) / 100;
		return usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function maxBoostAmount() {
		if (paymentType === 'alby' && $user.loggedIn) {
			return Math.floor(Math.min(($user.balance ?? 0) * 0.99, 5000000));
		}
		if (paymentType === 'wallet' && $wallet.balance != null) {
			return Math.floor(Math.min($wallet.balance * 0.99, 5000000));
		}
		return 5000000;
	}

	function markZapStatuses(invoices: ZapInvoice[], status: SplitStatus) {
		splitStatuses = Object.fromEntries(invoices.map((inv) => [inv.destIndex, status]));
	}

	async function handleZap() {
		if (paying) return;
		if (!$nostrEvent || !canPayZap) {
			payError = 'Could not load the Nostr event yet';
			return;
		}

		payError = '';
		localStorage.setItem('senderName', senderName);
		paying = true;
		splitStatuses = {};
		if (isMobile) activeScreen = 'splits';

		try {
			const invoices = await createZapInvoices({
				target: $nostrEvent,
				satAmount: amount,
				comment: boostagram
			});
			zapInvoices = invoices;

			if (paymentType === 'qr') {
				qrInvoiceIndex = 0;
				invoice = invoices[0]?.invoice;
				showQR = true;
				return;
			}

			if (paymentType === 'wallet') {
				const provider = getConnectedProvider() || $wallet.provider;
				if (!provider) {
					payError = 'Wallet is not connected';
					return;
				}

				const result = await sendZapWallet({
					provider,
					invoices,
					onPaymentResult: ({ destIndex, status }) => {
						if (destIndex == null) return;
						splitStatuses = { ...splitStatuses, [destIndex]: status };
					}
				});
				await refreshConnectedWalletBalance();
				if (result.failureCount === 0 && result.successCount > 0) {
					throwConfetti(amount);
					boostagram = '';
					await new Promise((resolve) => setTimeout(resolve, 800));
					showModal = false;
					splitStatuses = {};
					if ($wallet.balance != null) {
						$wallet.balance -= amount;
					}
				} else {
					payError = 'One or more zaps failed';
				}
				return;
			}

			if (paymentType === 'alby' && $user.loggedIn) {
				await refreshAlbyToken();
				await sendZapAlby(invoices);
				markZapStatuses(invoices, 'success');
				throwConfetti(amount);
				boostagram = '';
				await new Promise((resolve) => setTimeout(resolve, 800));
				showModal = false;
				splitStatuses = {};
				if ($user.balance != null) {
					$user.balance -= amount;
				}
			}
		} catch (err) {
			console.log(err);
			payError = err instanceof Error ? err.message : 'Zap failed';
			if (zapSplits.length) {
				splitStatuses = Object.fromEntries(zapSplits.map((row) => [row.destIndex, 'failed']));
			}
		} finally {
			paying = false;
		}
	}

	async function handleEffectBoost() {
		if (paying || !effectId) return;
		payError = '';
		const sats = Math.floor(Number(amount) || 0);
		localStorage.setItem('senderName', senderName);
		if (showExtras && sats >= 1) {
			onAttachSats(sats);
			return;
		}
		paying = true;
		try {
			await sendEffectBoost({
				effectId,
				boostagram,
				senderName,
				eventGuid: broadcastingBlock.eventGuid || getEventGuid(),
				blockGuid: broadcastingBlock.blockGuid
			});
			onEffectSent();
			boostagram = '';
			showModal = false;
		} catch (err) {
			console.log(err);
			payError = err instanceof Error ? err.message : 'Effect failed';
		} finally {
			paying = false;
		}
	}

	async function handleBoost() {
		if (paying) return;
		if (effectMode) {
			await handleEffectBoost();
			return;
		}
		payError = '';

		if (paymentType === 'qr') {
			localStorage.setItem('senderName', senderName);
			try {
				let data = await fetchLnurlInvoice(
					broadcastingBlock.eventGuid ? broadcastingBlock.eventGuid : getEventGuid(),
					{
						amount: amount * 1000,
						comment: boostagram,
						senderName,
						blockGuid: broadcastingBlock.blockGuid
					}
				);
				invoice = data.pr;
				showQR = true;
			} catch (err) {
				console.log(err);
				payError = err instanceof Error ? err.message : 'Boost failed';
			}
		} else if (paymentType === 'wallet') {
			const provider = getConnectedProvider() || $wallet.provider;
			if (!provider) {
				payError = 'Wallet is not connected';
				return;
			}

			localStorage.setItem('senderName', senderName);
			paying = true;
			splitStatuses = {};
			if (isMobile) activeScreen = 'splits';
			try {
				const result = await sendBoostWallet({
					provider,
					block: broadcastingBlock,
					satAmount: amount,
					boostagram,
					senderName,
					isDefault: fromIndex,
					onPaymentResult: ({ destIndex, status }) => {
						if (destIndex == null) return;
						splitStatuses = { ...splitStatuses, [destIndex]: status };
					}
				});
				await refreshConnectedWalletBalance();
				if (result.failureCount === 0 && result.successCount > 0) {
					throwConfetti(amount);
					boostagram = '';
					await new Promise((resolve) => setTimeout(resolve, 800));
					showModal = false;
					splitStatuses = {};
					if ($wallet.balance != null) {
						$wallet.balance -= amount;
					}
				} else if (result.failureCount > 0) {
					payError =
						result.failureCount === 1
							? '1 split has failed'
							: `${result.failureCount} splits have failed`;
				} else {
					payError = 'Boost failed';
				}
			} catch (err) {
				console.log(err);
				payError = err instanceof Error ? err.message : 'Boost failed';
			} finally {
				paying = false;
			}
		} else if (paymentType === 'alby' && $user.loggedIn) {
			paying = true;
			splitStatuses = {};
			if (isMobile) activeScreen = 'splits';
			try {
				await refreshAlbyToken();
				const result = await sendBoost({
					block: broadcastingBlock,
					satAmount: amount,
					boostagram,
					senderName,
					isDefault: fromIndex
				});
				const statuses: Record<number, SplitStatus> = {};
				let successCount = 0;
				let failureCount = 0;
				for (const payment of result.completedPayments ?? []) {
					const status: SplitStatus = payment.success ? 'success' : 'failed';
					const destIndex = payment.recipient?.destIndex;
					if (destIndex != null) statuses[destIndex] = status;
					if (payment.success) successCount += 1;
					else failureCount += 1;
				}
				splitStatuses = statuses;
				if (failureCount === 0 && successCount > 0) {
					throwConfetti(amount);
					localStorage.setItem('senderName', senderName);
					boostagram = '';
					await new Promise((resolve) => setTimeout(resolve, 800));
					showModal = false;
					splitStatuses = {};
					if ($user.balance != null) {
						$user.balance -= amount;
					}
				} else if (failureCount > 0) {
					payError =
						failureCount === 1 ? '1 split has failed' : `${failureCount} splits have failed`;
				} else {
					payError = 'Boost failed';
				}
			} catch (err) {
				console.log(err);
				payError = err instanceof Error ? err.message : 'Boost failed';
				const destinations = broadcastingBlock?.value?.destinations || [];
				splitStatuses = Object.fromEntries(destinations.map((_, i) => [i, 'failed']));
			} finally {
				paying = false;
			}
		}
	}

	async function handlePay() {
		if (isZap) {
			await handleZap();
			return;
		}
		await handleBoost();
	}

	function showNextZapInvoice() {
		if (qrInvoiceIndex + 1 >= zapInvoices.length) return;
		qrInvoiceIndex += 1;
		invoice = zapInvoices[qrInvoiceIndex]?.invoice;
	}

	$: console.log(broadcastingBlock);

	function handleKeyDown(event: KeyboardEvent) {
		const keyValue = event.key;
		if (keyValue === '.' || keyValue === 'e' || keyValue === 'E') {
			event.preventDefault();
		}
	}

	function enforceMinMax(event: FocusEvent) {
		if (amountLocked) return;
		const target = event.target as HTMLInputElement;
		if (effectMode && !showExtras) {
			const value = parseInt(target.value, 10);
			amount = Number.isFinite(value) && value > 0 ? Math.min(value, 5000000) : 0;
			return;
		}
		let value = parseInt(target.value, 10) || 1;
		const max = maxBoostAmount();
		if (max < 1) {
			amount = 1;
		} else if (value <= 1) {
			amount = 1;
		} else if (value > max) {
			amount = max;
		} else {
			amount = value;
		}
	}

	function setAmount(value: number) {
		if (amountLocked) return;
		if (effectMode && !showExtras) {
			amount = Math.max(0, Math.min(Math.floor(value), 5000000));
			return;
		}
		const max = maxBoostAmount();
		amount = max < 1 ? 1 : Math.min(value, max);
	}

	function toggleExtras() {
		showExtras = !showExtras;
		if (showExtras) {
			if (amount < 1) amount = 1;
		} else {
			activeScreen = 'boost';
		}
	}

	$: console.log(activeScreen);
</script>

<Modal bind:showModal bind:paymentType showNewPaymentType={!effectMode}>
	<boost-container>
		{#if effectMode}
			<div class="effect-use" class:expanded={showExtras}>
				{#if effectIcon}
					<img class="effect-icon" src={effectIcon} alt="" />
				{/if}
				<h2>{effectLabel}</h2>
				{#if showExtras && isMobile}
					<div class="screen-select">
						<button
							type="button"
							on:click={() => {
								activeScreen = 'boost';
							}}
							class:active={activeScreen === 'boost'}
						>
							Item
						</button>
						<button
							type="button"
							on:click={() => {
								activeScreen = 'splits';
							}}
							class:active={activeScreen === 'splits'}
						>
							Splits
						</button>
					</div>
				{/if}
				<panels class:mobile={isMobile}>
					<left
						class:hide={isMobile && showExtras && activeScreen === 'splits'}
						class:fullwidth={!showExtras || isMobile}
					>
						<label class="effect-name">
							<input type="text" bind:value={senderName} placeholder="Enter your name here..." />
						</label>
						<textarea bind:value={boostagram} rows="4" placeholder="Enter your message here..."></textarea>
						{#if showExtras}
							<amount-text>
								<h3>Amount</h3>
							</amount-text>
							<amount-container>
								<input
									class="amount"
									type="number"
									bind:value={amount}
									step="1"
									min={1}
									max={5000000}
									on:keydown={handleKeyDown}
									on:blur={enforceMinMax}
								/>
								<p class="sats">{amount > 1 ? '⚡ sats' : '⚡ sat'}</p>
								<p class="conversion">~${satsToDollars(amount)}</p>
							</amount-container>
						{/if}
					</left>
					{#if showExtras}
						<right class:hide={isMobile && activeScreen === 'boost'} class:fullwidth={isMobile}>
							<SplitList rows={splitRows} statuses={splitStatuses} {isZap} />
						</right>
					{/if}
				</panels>
				{#if showExtras}
					<btn-container class:hide={isMobile && activeScreen === 'splits'}>
						<button type="button" on:click={() => setAmount(1000)}>⚡ 1,000</button>
						<button type="button" on:click={() => setAmount(5000)}>⚡ 5,000</button>
						<button type="button" on:click={() => setAmount(10000)}>⚡ 10,000</button>
						<button type="button" on:click={() => setAmount(25000)}>⚡ 25,000</button>
					</btn-container>
				{/if}
				{#if payError}
					<p class="pay-error">{payError}</p>
				{/if}
				<button class="extras-toggle" type="button" aria-expanded={showExtras} on:click={toggleExtras}>
					{showExtras ? 'Hide sats' : 'Add sats'}
				</button>
				{#if payError}
					<button class="boost" type="button" on:click={() => (showModal = false)}>Close</button>
				{:else}
					<button class="boost" disabled={paying} on:click={handleBoost}>
						{paying ? 'Sending…' : showExtras ? 'Boost' : 'Use item'}
					</button>
				{/if}
			</div>
		{:else}
			<h2>{isZap ? $nostrEvent?.title || 'Zap' : broadcastingBlock.title}</h2>
			{#if isZap}
				<p class="intent-note">Zaps go to the linked Nostr event</p>
			{/if}

			{#if isMobile}
				<div class="screen-select">
					<button
						on:click={() => {
							activeScreen = 'boost';
						}}
						class:active={activeScreen === 'boost'}
					>
						{isZap ? 'Message' : 'Boostagram'}
					</button>
					<button
						on:click={() => {
							activeScreen = 'splits';
						}}
						class:active={activeScreen === 'splits'}
					>
						{isZap ? 'Recipients' : 'Splits'}
					</button>
				</div>
			{/if}
			<panels class:mobile={isMobile}>
				<left class:hide={isMobile && activeScreen === 'splits'} class:fullwidth={isMobile}>
					{#if $user.loggedIn && paymentType === 'alby'}
						<balance-text>
							<h3>Balance:</h3>
							<p>{$user.balance || 0} sats</p>
						</balance-text>
					{:else if paymentType === 'wallet' && $wallet.balance != null}
						<balance-text>
							<h3>Balance:</h3>
							<p>{$wallet.balance} sats</p>
						</balance-text>
					{/if}
					{#if !isZap}
						<label>
							<input type="text" bind:value={senderName} placeholder="Enter your name here..." />
						</label>
					{/if}
					<textarea bind:value={boostagram} rows="4" placeholder="Enter your message here..."></textarea>
					<amount-text>
						<h3>Amount</h3>
						{#if amountLocked}
							<p>This amount triggers {presetMessage || 'the effect'} on the stream</p>
						{:else if paymentType === 'alby' && $user.loggedIn}
							<p>between 1 and {maxBoostAmount()}</p>
						{:else if paymentType === 'wallet' && $wallet.balance != null}
							<p>between 1 and {maxBoostAmount()}</p>
						{/if}
					</amount-text>
					<amount-container>
						<input
							class="amount"
							type="number"
							bind:value={amount}
							step="1"
							min={1}
							max={5000000}
							readonly={amountLocked}
							on:keydown={handleKeyDown}
							on:blur={enforceMinMax}
						/>
						<p class="sats">{amount > 1 ? '⚡ sats' : '⚡ sat'}</p>
						<p class="conversion">~${satsToDollars(amount)}</p>
					</amount-container>
				</left>
				<right class:hide={isMobile && activeScreen === 'boost'} class:fullwidth={isMobile}>
					<SplitList rows={splitRows} statuses={splitStatuses} {isZap} />
				</right>
			</panels>
			{#if !amountLocked}
				<btn-container class:hide={isMobile && activeScreen === 'splits'}>
					<button on:click={() => setAmount(1000)}>⚡ 1,000</button>
					<button on:click={() => setAmount(5000)}>⚡ 5,000</button>
					<button on:click={() => setAmount(10000)}>⚡ 10,000</button>
					<button on:click={() => setAmount(25000)}>⚡ 25,000</button>
				</btn-container>
			{/if}
			{#if payError}
				<p class="pay-error">{payError}</p>
			{/if}
			{#if payError}
				<button class="boost" type="button" on:click={() => (showModal = false)}>Close</button>
			{:else}
				<button
					class:hide={isMobile && activeScreen === 'splits'}
					class="boost"
					class:zap={isZap}
					disabled={paying || (isZap && !canPayZap)}
					on:click={handlePay}
				>
					{paying ? 'Paying…' : isZap ? 'Zap' : 'Boost'}
				</button>
			{/if}
		{/if}
	</boost-container>
</Modal>

{#if showQR}
	<Modal bind:showModal={showQR} backgroundColor="rgb(0,0,0)" width="300px" height="300px">
		<div class="qr-container">
			<div class="qr">
				<QR code={invoice} />
			</div>
			{#if isZap && zapInvoices.length > 1}
				<p class="qr-progress">Invoice {qrInvoiceIndex + 1} of {zapInvoices.length}</p>
				{#if qrInvoiceIndex + 1 < zapInvoices.length}
					<button class="next-invoice" on:click={showNextZapInvoice}>Next invoice</button>
				{/if}
			{/if}
		</div>
	</Modal>
{/if}

<style>
	boost-container {
		width: calc(100% - 16px);
		margin: 0 8px;
		height: 100%;
		display: flex;
		flex-direction: column;
		color: white;
	}
	boost-container h2 {
		margin: 0;
		text-align: center;
		margin-top: 4px;
		min-height: 1.5em;
		width: 100%;
		font-size: 3em;
	}
	.intent-note,
	.pay-error,
	.qr-progress {
		margin: 0 0 8px;
		text-align: center;
		font-weight: 600;
	}
	.pay-error {
		color: #ff5c5c;
	}
	h3 {
		text-align: center;
		margin-top: 0;
		width: 100%;
	}
	p {
		text-align: center;
		font-weight: 600;
		color: white;
		font-size: 1em;
	}
	panels {
		display: flex;
		width: 100%;
		justify-content: space-between;
		height: calc(100% - 204px);
		flex: 1;
	}
	left,
	right {
		display: flex;
		width: calc(50% - 8px);
		margin-bottom: 8px;
		flex-direction: column;
	}

	boost-container textarea {
		width: calc(100% - 8px);
		resize: none;
		margin: 8px 0;
		height: 200px;
		padding: 4px;
		flex: 1;
		background-color: transparent;
		border: none;
		color: white;
		outline: 1px solid white;
		font-size: 16px;
		font-weight: 600;
	}
	boost-container textarea::placeholder {
		font-weight: 600;
	}
	balance-text,
	amount-text {
		display: flex;
		width: 100%;
		justify-content: space-between;
		align-items: flex-end;
	}
	balance-text h3,
	amount-text h3 {
		margin: 0;
		min-height: 1em;
		width: initial;
	}
	balance-text p,
	amount-text p {
		margin: 0;
		text-align: right;
		width: initial;
		min-height: 1em;
		color: white;
	}

	balance-text {
		justify-content: center;
		font-size: 1.5em;
	}

	balance-text > p {
		margin-left: 8px;
	}

	amount-container {
		width: 100%;
		display: block;
		position: relative;
		margin-bottom: 8px;
	}
	.amount {
		width: calc(100% - 16px);
		padding: 2px 8px 20px 8px;
		font-size: 1.3em;
	}
	amount-container p {
		position: absolute;
		top: 4px;
		padding: 0 8px;
	}
	amount-container .sats {
		left: 0;
	}
	amount-container .conversion {
		right: 0;
	}
	btn-container {
		display: flex;
		justify-content: space-around;
		width: 100%;
	}
	btn-container button {
		width: 20%;
	}

	button {
		background-color: hsl(2, 35%, 52%);
		background-color: hsl(195, 94%, 75%);
		color: hsl(195, 100%, 25%);
		padding: 4px 12px;
		border: none;
		border-radius: 25px;
		font-size: 1.2em;
		cursor: pointer;
		margin: 8px 0;
		height: 50px;
		box-shadow: none;
	}

	.boost {
		width: calc(100% - 16px);
		background-color: hsl(0, 52%, 39%);
		background-color: hsl(195, 94%, 50%);
		color: hsl(195, 100%, 10%);
		font-weight: 600;
		margin: 8px 0 16px 0;
		box-shadow: none;
		font-size: 1.6em;
	}

	.boost.zap {
		background-color: #8b5cf6;
		color: white;
	}

	.boost:disabled {
		width: calc(100% - 16px);

		background-color: hsl(195, 94%, 95%);
		color: hsl(195, 100%, 15%);
	}

	.boost.zap:disabled {
		background-color: #ddd6fe;
		color: #4c1d95;
	}

	.next-invoice {
		margin-top: 36px;
	}
	input,
	textarea {
		background-color: transparent;
		border: none;
		color: white;
		outline: 1px solid white;
		padding: 2px;
		font-weight: 600;
		font-size: 16px;
	}
	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
	label {
		display: flex;
		flex-direction: column;
		font-weight: 600;
	}

	.qr-container {
		width: 100%;
		height: calc(100%);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		top: -30px;
	}

	.qr {
		width: 260px;
		height: 260px;
	}

	.screen-select {
		width: 100%;
		display: flex;
		justify-content: space-evenly;
		height: 50px;
	}

	.screen-select > button {
		width: 108px;
		height: auto;
		padding: 0;
		border-radius: 0;
		background-color: transparent;
		color: white;
	}

	.screen-select > button.active {
		border-bottom: 2px solid white;
	}

	.fullwidth {
		width: 100%;
	}

	.hide {
		display: none;
	}

	.effect-use {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: 100%;
		box-sizing: border-box;
		padding: 8px 0 16px;
	}

	.effect-icon {
		height: 140px;
		width: auto;
		max-width: 70%;
		object-fit: contain;
		image-rendering: pixelated;
		filter: drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45));
	}

	.effect-use h2 {
		margin: 0;
	}

	.effect-name {
		width: 100%;
	}

	.effect-use left {
		gap: 8px;
	}

	.effect-name input,
	.effect-use textarea {
		width: 100%;
		box-sizing: border-box;
		margin: 0;
		padding: 8px;
		font-family: inherit;
		font-size: 16px;
		font-weight: 600;
		line-height: 1.4;
	}

	.effect-name input::placeholder,
	.effect-use textarea::placeholder {
		font-family: inherit;
		font-size: 16px;
		font-weight: 600;
		line-height: 1.4;
		color: rgba(255, 255, 255, 0.65);
		opacity: 1;
	}

	.effect-use textarea {
		flex: 0 0 auto;
	}

	.effect-use panels {
		height: auto;
		flex: 0 1 auto;
	}

	.effect-use.expanded {
		flex: 1;
		min-height: 0;
		width: 100%;
	}

	.effect-use.expanded .effect-icon,
	.effect-use.expanded h2,
	.effect-use.expanded .screen-select,
	.effect-use.expanded btn-container,
	.effect-use.expanded .pay-error,
	.effect-use.expanded .extras-toggle,
	.effect-use.expanded .boost {
		flex-shrink: 0;
	}

	.effect-use.expanded panels {
		flex: 1;
		min-height: 0;
		height: auto;
	}

	.effect-use.expanded left,
	.effect-use.expanded right {
		min-height: 0;
	}

	.effect-use.expanded .effect-icon {
		height: 64px;
	}

	.effect-use.expanded textarea {
		flex: 1 1 auto;
		min-height: 72px;
		height: auto;
	}

	.effect-use .intent-note,
	.effect-use .pay-error {
		margin: 0;
	}

	.effect-use .boost {
		width: 100%;
		margin: 0;
	}

	.extras-toggle {
		background: none;
		border: none;
		box-shadow: none;
		height: auto;
		margin: 0;
		padding: 4px 8px;
		color: #ffe14a;
		font-size: 1.2em;
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
	}

	.extras-toggle:hover {
		color: #fff4a8;
	}
</style>
