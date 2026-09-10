<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getLightningAddress } from '$/stores';

	let qrCodeCanvas: HTMLCanvasElement | undefined;
	let container: HTMLButtonElement | undefined;
	export let code = getLightningAddress() ?? '';
	export let imgSrc = '';
	let observer: ResizeObserver | undefined;

	async function generateQRCode() {
		if (!qrCodeCanvas || !container) return;

		const { default: QRCode } = await import('qrcode');
		const size = container.clientWidth;

		QRCode.toCanvas(qrCodeCanvas, code, {
			width: size,
			color: {
				dark: '#000000',
				light: '#ffffff'
			}
		}).catch(console.error);
	}

	onMount(() => {
		generateQRCode();

		observer = new ResizeObserver(generateQRCode);
		if (container) observer.observe(container);
	});

	onDestroy(() => {
		if (observer && container) observer.unobserve(container);
	});

	function copyCodeToClipboard() {
		navigator.clipboard.writeText(code);
		alert('Copied Link to clipboard');
	}
</script>

<button class="qr-wrapper" bind:this={container} on:click={copyCodeToClipboard}>
	{#if imgSrc}
		<img src="./qrbg.png" alt="QR Background" />
	{/if}
	<canvas bind:this={qrCodeCanvas}></canvas>
	<p>- click invoice to copy to clipboard -</p>
</button>

<style>
	.qr-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		background-color: transparent;
		border: none;
		box-shadow: none;
	}

	img,
	canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

	p {
		position: absolute;
		bottom: -24px;
		color: #ffffff;
		padding: 0;
		margin: 0;
	}
</style>
