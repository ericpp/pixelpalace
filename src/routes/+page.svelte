<script lang="ts">
	import { onMount } from 'svelte';
	import Desktop from './Desktop/Desktop.svelte';
	import {
		getRemoteServer,
		getEventGuid,
		getEventSocketUrl,
		getNostrEventPointer,
		getNostrRelays,
		liveBlocks,
		mainSettings,
		nostrEvent
	} from '$/stores';
	import { connectEventSocket } from '$lib/socket';
	import { hydrateNostrEvent, parseNostrPointer } from '$lib/nostr/resolveEvent';
	import type { Block, MainSettings } from '$lib/types';

	const guid = getEventGuid();
	const controlGuid = getEventGuid();

	let broadcastingBlock: Block = {};

	let showConfetti = false;
	let confettiAmount = 1;

	onMount(() => {
		loadBlocks();
		loadNostrEvent();
		const url = getEventSocketUrl(controlGuid);
		const socketPromise = connectEventSocket(url);

		socketPromise.then((liveItemSocket) => {
			liveItemSocket.on('remoteValue', function (data: Block) {
				console.log(data);
				if (data.blockGuid) {
					broadcastingBlock = data;
				} else {
					broadcastingBlock = $liveBlocks[0] ?? {};
				}
				console.log(broadcastingBlock);
			});
			liveItemSocket.on('playerPause', function (data: unknown) {
				// You will need to adjust this part based on the actual format of the data sent by the server
				console.log(data);
			});
		});

		return () => {
			socketPromise.then((socket) => socket.disconnect());
		};
	});

	async function loadNostrEvent() {
		const pointer = getNostrEventPointer();
		if (!pointer) {
			$nostrEvent = null;
			return;
		}

		try {
			const parsed = parseNostrPointer(pointer, getNostrRelays());
			$nostrEvent = parsed;
			$nostrEvent = await hydrateNostrEvent(parsed);
		} catch (err) {
			console.error('Failed to resolve PUBLIC_NOSTR_EVENT', err);
		}
	}

	async function loadBlocks() {
		if (!$liveBlocks?.length) {
			const res = await fetch(getRemoteServer() + '/api/sk/getblocks?guid=' + guid);
			const data = (await res.json()) as { blocks: Block[]; settings: MainSettings };
			broadcastingBlock = data.blocks[0] ?? {};
			$liveBlocks = data.blocks;
			$mainSettings = data.settings;
		}
	}

	const boostArt = {
		default: ['url(/flower.png)', 'url(/flower2.png)', 'url(/flower3.png)'],
		weed: ['url(/weed.png)'],
		boob: ['url(/boobs.png)'],
		dick: ['url(/dick.png)']
	};

	function selectBoostArt() {
		if (confettiAmount >= 1111 && /^1+$/.test(String(confettiAmount))) {
			return boostArt.dick;
		} else if (String(confettiAmount).includes('420')) {
			return boostArt.weed;
		} else if (confettiAmount === 8008 || confettiAmount === 80085) {
			return boostArt.boob;
		} else {
			return boostArt.default;
		}
	}

	function throwConfetti(amount: number) {
		showConfetti = true;
		confettiAmount = amount;
		setTimeout(() => {
			showConfetti = false;
		}, 6000);
	}
</script>

<div class="container">
	<Desktop {guid} {broadcastingBlock} {throwConfetti} />
</div>

{#if showConfetti}
	{#await import('svelte-confetti') then { Confetti }}
		<div class="confetti left">
			<Confetti cone size={30} duration={6000} x={[0, 2]} y={[0, 3]} colorArray={selectBoostArt()} />
		</div>
		<div class="confetti right">
			<Confetti cone size={30} duration={6000} x={[-2, 0]} y={[0, 3]} colorArray={selectBoostArt()} />
		</div>
	{/await}
{/if}

<style>
	.container {
		position: relative;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}
	.confetti {
		position: absolute;
		bottom: 0;
	}

	.confetti.right {
		right: 0;
	}
</style>
