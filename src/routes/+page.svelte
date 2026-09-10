<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { getRemoteServer, getEventGuid, getEventSocketUrl, liveBlocks, mainSettings } from '$/stores';
	import { connectEventSocket } from '$lib/socket';
	import type { Block, MainSettings } from '$lib/types';

	const guid = getEventGuid();
	const controlGuid = getEventGuid();

	let isMobile = false;
	let broadcastingBlock: Block = {};

	let showConfetti = false;
	let confettiAmount = 1;
	let loaded = false;
	let Layout: Component<{
		guid: string;
		broadcastingBlock: Block;
		throwConfetti: (amount: number) => void;
	}> | undefined;

	async function loadLayout(mobile: boolean) {
		const mod = mobile
			? await import('./Mobile/Mobile.svelte')
			: await import('./Desktop/Desktop.svelte');
		Layout = mod.default;
		loaded = true;
	}

	const checkScreenWidth = () => {
		const mobile = window.innerWidth < 996;
		if (mobile !== isMobile || !Layout) {
			isMobile = mobile;
			loadLayout(mobile);
		}
	};

	onMount(() => {
		checkScreenWidth();
		window.addEventListener('resize', checkScreenWidth);

		loadBlocks();
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
			window.removeEventListener('resize', checkScreenWidth);
			socketPromise.then((socket) => socket.disconnect());
		};
	});

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

<div class="container" class:loaded>
	{#if Layout}
		<Layout {guid} {broadcastingBlock} {throwConfetti} />
	{/if}
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
		display: none;
	}
	.loaded {
		display: initial;
	}
	.confetti {
		position: absolute;
		bottom: 0;
	}

	.confetti.right {
		right: 0;
	}
</style>
