<script>
	import BoostPage from './BoostPage.svelte';
	import Venmo from './Venmo.svelte';
	import PaymentSelector from './PaymentSelector.svelte';

	export let broadcastingBlock;
	export let showInstructions;
	export let throwConfetti;
	export let isMobile;
	let showModal = false;
	let paymentType;

	$: console.log(paymentType);
	$: console.log(showModal);
</script>

<div class="container">
	<button
		class="boost-btn boost"
		class:mobile={isMobile}
		on:click={() => {
			showModal = true;
		}}
	>
		Boost
	</button>
</div>

{#if showModal}
	{#if !paymentType}
		<PaymentSelector bind:paymentType bind:showModal />
	{:else if paymentType === 'venmo'}
		<Venmo bind:showModal bind:paymentType />
	{:else}
		<BoostPage bind:showModal {broadcastingBlock} bind:paymentType {throwConfetti} {isMobile} />
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

	.mobile {
		padding: 8px 18px;
		border-radius: 8px;
		font-size: 36px;
		font-weight: 500;
	}
</style>
