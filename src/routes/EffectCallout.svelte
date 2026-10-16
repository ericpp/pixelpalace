<script lang="ts">
	import { onDestroy } from 'svelte';
	import { firedEffect } from '$/stores';
	import { EFFECT_ICONS, isEffectId } from '$lib/effects';

	let timer: ReturnType<typeof setTimeout> | undefined;

	$: if ($firedEffect) {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			firedEffect.set(null);
		}, 8000);
	}

	onDestroy(() => {
		if (timer) clearTimeout(timer);
	});
</script>

{#if $firedEffect}
	<div class="callout" role="status">
		{#if isEffectId($firedEffect.id)}
			<img src={EFFECT_ICONS[$firedEffect.id]} alt="" />
		{/if}
		<div class="copy">
			<p class="label">{$firedEffect.label}</p>
			{#if $firedEffect.senderName}
				<p class="who">{$firedEffect.senderName}</p>
			{/if}
			{#if $firedEffect.message && $firedEffect.message !== $firedEffect.label}
				<p class="note">{$firedEffect.message}</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.callout {
		position: fixed;
		z-index: 40;
		left: 18px;
		bottom: 16px;
		width: max-content;
		max-width: 176px;
		padding: 8px 12px 10px;
		box-sizing: border-box;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-align: center;
		color: #fbf0d9;
		background-color: var(--wood-dark);
		background-image: url('/wood-grain.png');
		border: 5px solid var(--wood-light);
		border-radius: 8px;
		box-shadow:
			0 0 0 3px var(--wood-outline),
			inset 0 0 0 3px var(--wood-outline),
			0 7px 0 rgba(0, 0, 0, 0.35);
		font-family: var(--font-pixel);
		pointer-events: none;
	}

	img {
		height: 42px;
		width: auto;
		max-width: 100%;
		flex: 0 0 auto;
		object-fit: contain;
		image-rendering: pixelated;
		filter: drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45));
	}

	.copy {
		width: 100%;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	p {
		margin: 0;
		max-width: 100%;
		overflow-wrap: anywhere;
		-webkit-text-stroke: 3px #000;
		paint-order: stroke fill;
	}

	.label {
		font-size: 20px;
		font-weight: 700;
		line-height: 1.15;
	}

	.who,
	.note {
		font-size: 14px;
		font-weight: 600;
		line-height: 1.2;
	}

	@media (max-width: 720px) {
		.callout {
			left: 8px;
			bottom: 8px;
		}
	}

	.note {
		color: #ffe14a;
	}
</style>
