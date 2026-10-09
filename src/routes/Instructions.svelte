<script lang="ts">
	import { onMount } from 'svelte';
	import Close from '$lib/icons/Close.svelte';

	export let closeModal = () => {};
	export let showInstructions = false;

	onMount(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		document.addEventListener('keydown', handleKeyDown);

		return () => document.removeEventListener('keydown', handleKeyDown);
	});

	function onClose() {
		closeModal();

		showInstructions = false;
	}
</script>

<blurred-background
	role="button"
	tabindex="-1"
	aria-label="Close"
	on:mousedown|self={onClose}
	on:touchend|self={onClose}
>
	<modal style="--aspect-ratio: {950 / 1220};">
		<button class="close" on:click={onClose}>
			<Close size="24" />
		</button>
		<div>
			<h1>How can you support the festival?</h1>

			<ol>
				<li class="item">
					Click on the Boost button to send direct support to the artist and crew.
					The event MCs are always updating who the support goes to
					based on what's going on with the show.
				</li>
				<li class="item">
					Select the method you want to use to send your support.
					You can use your Lightning wallet, Alby wallet, QR code, or Venmo?
				</li>
				<li class="item">
					Enter a name, amount, and a message you want to send to the artist and crew.
				</li>
				<li class="item">
					Click "Boost" to Boost!
				</li>

				<!-- 
				<li class="item">
					<p>
						You can also scan the QR code (or click it to copy the address to your clipboard), and
						support from the wallet of your choice.
					</p>
				</li> -->
			</ol>
		</div>
	</modal>
</blurred-background>

<style>
	blurred-background {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		position: fixed;
		background: transparent;
		top: 0;
		right: 0;
		z-index: 100;
		backdrop-filter: blur(5px);
	}

	modal {
		display: block;
		position: relative;
	}

	.close {
		position: absolute;
		top: 20px;
		right: 30px;
		background-color: transparent;
		padding: 8px;
		color: rgba(0, 0, 0, 0.75);
		z-index: 33;
		border: 1px solid transparent;
		box-shadow: none;
	}

	div {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		background-color: #f6ecd4;
		background-image: url('/list-bg.webp');
		height: 100vh;
		width: calc(100vh * var(--aspect-ratio));
		max-height: 920px;
		max-width: calc(918px * var(--aspect-ratio));
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
		margin: 0 auto;
		font-family: 'IndieFlower';
	}

	h1 {
		color: rgb(86, 35, 18);
		margin: 100px 32px 32px 32px;
		font-size: 1.7em;
		font-family: 'HomemadeApple';
		text-align: center;
	}

	ol {
		flex: 1;
		margin: 0 0 0 calc(100% * 0.175);
		color: rgb(86, 35, 18);
		font-size: 1.2em;
		padding: 0;
		margin: 0 80px;
	}

	li {
		margin: 0 0 16px 0;
		position: relative;
		padding: 0;
	}

	p {
		margin: 0 auto;
		width: 100%;
		bottom: 32px;
		font-size: 0.9em;
		line-height: 1em;
	}

	@media (max-width: 950px) {
		modal {
			position: relative;
			width: 100%;
			height: 100%;
			overflow-y: auto;
			overflow-x: hidden;
			border-radius: 0;
		}

		div {
			background-color: #f6ecd4;
			background-image: url('/list-bg-mobile.webp');
			height: 100vh;
			width: 100vw;
			max-height: 100vh;
			max-width: 100vw;
			background-size: 100% 100%;
		}

		h1 {
			margin: 50px auto 8px auto;
			font-size: 1.5em;
		}

		ol {
			flex: 1;
			margin-left: calc(100vw * 0.1);
			color: rgb(86, 35, 18);
			font-size: 1.1em;
		}

		.close {
			top: 16px;
			right: 16px;
		}
	}
</style>
