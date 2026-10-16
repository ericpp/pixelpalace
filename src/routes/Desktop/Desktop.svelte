<script lang="ts">
	import { onMount } from 'svelte';
	import Boost from '../Boost.svelte';
	import Video from '../Video.svelte';
	import Chat from '../Chat.svelte';
	import TopBoosters from '../TopBoosters.svelte';
	import TopBar from '../TopBar.svelte';
	import Instructions from '../Instructions.svelte';
	import Backpack from './Backpack.svelte';
	import { isNostrEventConfigured, getDefaultBackgroundUrl } from '$/stores';
	import type { Block, PaymentIntent } from '$lib/types';

	export let guid: string;
	export let broadcastingBlock: Block;
	export let throwConfetti: (amount: number) => void;

	const zapEnabled = isNostrEventConfigured();

	type MobileTab = 'video' | 'chat' | 'boosters';

	let mobileTab: MobileTab = 'video';
	let isNarrow = false;
	let showBoost = false;
	let showInstructions = false;
	let paymentIntent: PaymentIntent = 'boost';
	let presetAmount: number | undefined = undefined;
	let presetMessage = '';
	let effectId: string | undefined = undefined;

	function openBoost(intent: PaymentIntent, amount?: number, message = '') {
		effectId = undefined;
		paymentIntent = intent;
		presetAmount = amount;
		presetMessage = message;
		showBoost = true;
	}

	function openEffect(id: string) {
		effectId = id;
		paymentIntent = 'boost';
		presetAmount = undefined;
		presetMessage = '';
		showBoost = true;
	}

	function onBoostPaid(amount: number) {
		throwConfetti(amount);
	}

	function onEffectSent() {
		throwConfetti(0);
		effectId = undefined;
	}

	$: if (!showBoost) effectId = undefined;

	onMount(() => {
		const media = window.matchMedia('(max-width: 995px)');
		const update = () => (isNarrow = media.matches);
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});
</script>

<!--<img
	class="background"
	alt=""
	src={$mainSettings?.liveBackgroundUrl ? $mainSettings?.liveBackgroundUrl : getDefaultBackgroundUrl()}
/>-->
<img
	class="background"
	alt=""
	src={getDefaultBackgroundUrl()}
/>

<div class="stage" data-tab={mobileTab}>
	<div class="bar">
		<TopBar nowPlaying={broadcastingBlock?.title} onHowTo={() => (showInstructions = true)} />
	</div>

	<nav class="tabs" aria-label="Sections">
		<button class:active={mobileTab === 'video'} on:click={() => (mobileTab = 'video')}>Video</button>
		<button class:active={mobileTab === 'chat'} on:click={() => (mobileTab = 'chat')}>Chat</button>
		<button class:active={mobileTab === 'boosters'} on:click={() => (mobileTab = 'boosters')}>
			Boosters
		</button>
	</nav>

	<TopBoosters />

	<div class="video-wrap wood-frame">
		<Video {guid} />
	</div>

	<div class="chat-frame wood-frame">
		<Chat />
	</div>

	<div class="controls">
		<Backpack onUse={(effect) => openEffect(effect.id)} onBoost={() => openBoost('boost')} />
		{#if zapEnabled}
			<button class="board-btn" on:click={() => openBoost('zap')}>
				<span>⚡</span>
				<span>Zap</span>
			</button>
		{/if}
	</div>
</div>

{#if showInstructions}
	<Instructions bind:showInstructions />
{/if}

<Boost
	appearance="headless"
	bind:showModal={showBoost}
	bind:paymentIntent
	{presetAmount}
	{presetMessage}
	{effectId}
	{broadcastingBlock}
	isMobile={isNarrow}
	throwConfetti={onBoostPaid}
	{onEffectSent}
/>

<style>
	.background {
		position: absolute;
		height: 100%;
		width: 100%;
		top: 0;
		object-fit: cover;
		z-index: 0;
		background-color: black;
	}

	.stage {
		position: relative;
		z-index: 1;
		height: 100%;
		width: 100%;
		box-sizing: border-box;
		display: grid;
		grid-template-columns: minmax(220px, 300px) minmax(0, 1fr) minmax(240px, 340px);
		grid-template-rows: auto minmax(0, 1fr) clamp(108px, 16vh, 148px);
		grid-template-areas:
			'bar bar bar'
			'sign video chat'
			'sign controls controls';
		gap: 34px 20px;
		padding: 6px 18px 16px;
	}

	.stage > .bar {
		margin-bottom: -22px;
	}

	.bar {
		grid-area: bar;
		position: relative;
		z-index: 2;
		min-width: 0;
	}

	.stage > :global(section) {
		grid-area: sign;
		min-height: 0;
	}

	.wood-frame {
		position: relative;
		box-sizing: border-box;
		padding: 10px;
		border: 3px solid var(--wood-outline);
		border-radius: 8px;
		background-color: var(--wood-cream);
		background-image:
			linear-gradient(180deg, rgba(255, 250, 235, 0.5), rgba(255, 250, 235, 0) 40%, rgba(90, 55, 20, 0.22)),
			repeating-linear-gradient(90deg, rgba(120, 78, 36, 0.12) 0 2px, transparent 2px 9px);
		box-shadow:
			inset 0 0 0 2px #f8ecd0,
			inset 0 0 0 5px #b98d5a,
			0 6px 0 rgba(0, 0, 0, 0.35),
			0 14px 30px rgba(0, 0, 0, 0.45);
	}

	.video-wrap {
		grid-area: video;
		min-width: 0;
		min-height: 0;
		display: flex;
	}

	.video-wrap :global(container) {
		flex: 1;
		min-height: 0;
		border: 3px solid var(--wood-outline);
		border-radius: 3px;
		box-sizing: border-box;
	}

	.chat-frame {
		grid-area: chat;
		min-width: 0;
		min-height: 0;
	}

	.chat-frame :global(.chat) {
		height: 100%;
		min-height: 0;
		background: #f6f3ee;
		border: 3px solid var(--wood-outline);
		border-radius: 3px;
		box-sizing: border-box;
		overflow: hidden;
	}

	.controls {
		grid-area: controls;
		min-width: 0;
		display: flex;
		align-items: stretch;
		justify-content: center;
		gap: 14px;
		overflow: hidden;
	}

	.board-btn {
		position: relative;
		flex: 0 0 auto;
		height: 100%;
		width: clamp(108px, 14vw, 160px);
		margin: 0;
		padding: 8px 6px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		color: #fbf0d9;
		background-color: var(--wood-dark);
		background-image: url('/wood-grain.png');
		border: 5px solid var(--wood-light);
		border-radius: 6px;
		box-shadow:
			0 0 0 3px var(--wood-outline),
			inset 0 0 0 3px var(--wood-outline),
			inset 0 5px 0 3px rgba(255, 200, 140, 0.12),
			0 7px 0 3px rgba(0, 0, 0, 0.4);
		font-family: var(--font-pixel);
		font-weight: 600;
		font-size: clamp(15px, 1.5vw, 24px);
		line-height: 1.1;
		-webkit-text-stroke: 4px #000;
		paint-order: stroke fill;
		text-shadow:
			-2px -2px 0 #000,
			0 -2px 0 #000,
			2px -2px 0 #000,
			-2px 0 0 #000,
			2px 0 0 #000,
			-2px 2px 0 #000,
			0 2px 0 #000,
			2px 2px 0 #000;
		cursor: pointer;
		transition: transform 0.08s ease, border-color 0.08s ease;
	}

	.board-btn span {
		position: relative;
		z-index: 1;
		display: block;
		max-width: 100%;
		text-align: center;
	}

	.board-btn:hover {
		border-color: #c8904f;
	}

	.board-btn:active {
		transform: translateY(1px);
	}

	.board-btn:focus-visible {
		outline: 3px solid #ffe14a;
		outline-offset: 5px;
	}

	.tabs {
		display: none;
	}

	@media (max-width: 995px) {
		.stage {
			grid-template-columns: 1fr;
			grid-template-rows: auto auto minmax(0, 1fr) auto;
			grid-template-areas:
				'bar'
				'tabs'
				'main'
				'controls';
			gap: 10px;
			padding: 6px 10px 12px;
		}

		.stage > .bar {
			margin-bottom: 0;
		}

		.tabs {
			grid-area: tabs;
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 8px;
		}

		.tabs button {
			margin: 0;
			height: 40px;
			padding: 0 6px;
			box-sizing: border-box;
			color: #fbf0d9;
			background-color: var(--wood-dark);
			background-image: url('/wood-grain.png');
			border: 3px solid var(--wood-light);
			border-radius: 6px;
			box-shadow:
				0 0 0 2px var(--wood-outline),
				inset 0 0 0 2px var(--wood-outline);
			font-family: var(--font-pixel);
			font-weight: 600;
			font-size: 16px;
			line-height: 1;
			-webkit-text-stroke: 3px #000;
			paint-order: stroke fill;
			text-shadow:
				-1px -1px 0 #000,
				0 -1px 0 #000,
				1px -1px 0 #000,
				-1px 0 0 #000,
				1px 0 0 #000,
				-1px 1px 0 #000,
				0 1px 0 #000,
				1px 1px 0 #000;
		}

		.tabs button.active {
			border-color: #ffe14a;
			color: #ffe14a;
		}

		.tabs button:focus-visible {
			outline: 3px solid #ffe14a;
			outline-offset: 3px;
		}

		.stage > :global(section) {
			display: none;
		}

		.stage[data-tab='boosters'] > :global(section) {
			display: block;
			grid-area: main;
			min-height: 0;
			overflow: auto;
		}

		.video-wrap,
		.chat-frame {
			grid-area: main;
		}

		.controls {
			grid-area: controls;
		}

		.video-wrap.wood-frame {
			padding: 0;
			border: none;
			border-radius: 0;
			background: none;
			box-shadow: none;
		}

		.video-wrap :global(container) {
			border: none;
			border-radius: 0;
		}

		.stage[data-tab='video'] .chat-frame,
		.stage[data-tab='chat'] .video-wrap,
		.stage[data-tab='boosters'] .video-wrap,
		.stage[data-tab='boosters'] .chat-frame {
			display: none;
		}

		.controls {
			flex-flow: row wrap;
			align-items: stretch;
			justify-content: center;
			overflow: visible;
			gap: 10px;
		}

		.board-btn {
			order: 2;
			height: 110px;
			width: auto;
			min-width: 0;
			flex: 1 1 0;
		}
	}
</style>
