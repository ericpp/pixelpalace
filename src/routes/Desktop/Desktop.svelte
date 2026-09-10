<script lang="ts">
	import Boost from '../Boost.svelte';
	import Video from '../Video.svelte';
	import Chat from '../Chat.svelte';
	import BoostBoard from '../BoostBoard.svelte';
	import Instructions from '../Instructions.svelte';
	import { mainSettings, getDefaultBackgroundUrl } from '$/stores';
	import type { Block } from '$lib/types';

	export let guid: string;
	export let broadcastingBlock: Block;
	export let throwConfetti: (amount: number) => void;
	let showInstructions = false;
</script>

<img
	class="background"
	alt="boo-background"
	src={$mainSettings?.liveBackgroundUrl ? $mainSettings?.liveBackgroundUrl : getDefaultBackgroundUrl()}
/>

<container>
	<div class="middle">
		<BoostBoard />
		<Boost {broadcastingBlock} {throwConfetti} />
	</div>

	<Video {guid} />

	<Chat />
</container>

{#if showInstructions}
	<Instructions bind:showInstructions />
{/if}

<style>
	.background {
		position: absolute;
		height: 100%;
		width: 100%;
		top: 0;
		object-fit: cover;
		z-index: -1;
		background-color: black;
	}

	container {
		height: calc(100% - 16px);
		width: calc(100% - 16px);
		margin: 8px;
		overflow: hidden;
		display: grid;
		grid-template-columns: 300px 1fr 300px;
		grid-template-rows: 1fr;
		grid-column-gap: 8px;
		grid-row-gap: 0px;
	}

	.middle {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr 100px;
		grid-column-gap: 8px;
		grid-row-gap: 0px;
	}
</style>
