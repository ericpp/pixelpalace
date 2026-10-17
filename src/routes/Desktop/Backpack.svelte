<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Modal from '../Modal.svelte';
	import { EFFECT_ICONS, EFFECT_LABELS, type EffectId } from '$lib/effects';
	import { effectSlots, effectSlotsUpdatedAt } from '$/stores';
	import { requestEffectSync } from '$lib/liveSocket';
	import type { EffectSlotState } from '$lib/types';

	type Effect = {
		id: EffectId;
		label: string;
		prop: { src: string; h: number; x: number; sink: number };
	};

	const layout: Record<EffectId, Omit<Effect['prop'], 'src'>> = {
		wide: { h: 84, x: 50, sink: 26 },
		bubbles: { h: 86, x: 50, sink: 30 },
		fence: { h: 72, x: 50, sink: 30 },
		dj: { h: 58, x: 50, sink: 20 },
		festoons: { h: 66, x: 50, sink: 36 },
		discoball: { h: 96, x: 50, sink: 36 }
	};

	const effects: Effect[] = (Object.keys(layout) as EffectId[]).map((id) => ({
		id,
		label: EFFECT_LABELS[id],
		prop: { src: EFFECT_ICONS[id], ...layout[id] }
	}));

	export let onUse: (effect: Effect) => void;
	export let onBoost: () => void;

	const RESYNC_MS = 2000;

	let open = false;
	let last = Date.now();
	let seenStamp = 0;
	let timer: ReturnType<typeof setInterval> | undefined;
	let nextSyncAt = 0;

	type SlotView = { unlocked: boolean; seconds: number | null };
	let views: Record<string, SlotView> = {};
	let remaining: Record<string, number | null> = {};

	function mergeSlots(slots: EffectSlotState[]): void {
		const next: Record<string, number | null> = {};
		for (const slot of slots) {
			if (slot.unlocked) {
				next[slot.id] = null;
				continue;
			}
			const local = remaining[slot.id];
			next[slot.id] =
				local == null || Math.abs(local - slot.remainingMs) > RESYNC_MS ? slot.remainingMs : local;
		}
		remaining = next;
	}

	function buildViews(current: Record<string, number | null>): Record<string, SlotView> {
		const next: Record<string, SlotView> = {};
		for (const [id, ms] of Object.entries(current)) {
			next[id] = {
				unlocked: ms == null,
				seconds: ms == null ? 0 : Math.max(0, Math.ceil(ms / 1000))
			};
		}
		return next;
	}

	$: if ($effectSlotsUpdatedAt !== seenStamp) {
		seenStamp = $effectSlotsUpdatedAt;
		mergeSlots($effectSlots);
	}

	$: views = buildViews(remaining);

	function packCooldownLabel(current: Record<string, SlotView>): string | null {
		const slots = Object.values(current);
		if (slots.length === 0) return 'Wait';
		const locked = slots.filter((slot) => !slot.unlocked);
		if (locked.length === 0) return null;
		const known = locked
			.map((slot) => slot.seconds)
			.filter((seconds): seconds is number => seconds != null);
		if (known.length === 0) return 'Wait';
		return `${Math.min(...known)}s`;
	}

	function packAriaLabel(isOpen: boolean, label: string | null): string {
		if (isOpen) return 'Close backpack';
		if (label == null) return 'Open backpack';
		if (label === 'Wait') return 'Open backpack, pack recharging';
		const seconds = label.endsWith('s') ? label.slice(0, -1) : label;
		return `Open backpack, pack recharging, ${seconds} seconds`;
	}

	$: cooldown = packCooldownLabel(views);

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') close();
	}

	function useEffect(effect: Effect) {
		if (!views[effect.id]?.unlocked) return;
		close();
		onUse(effect);
	}

	onMount(() => {
		timer = setInterval(() => {
			const time = Date.now();
			const step = time - last;
			last = time;
			if (step > 0) {
				const next: Record<string, number | null> = {};
				for (const [id, ms] of Object.entries(remaining)) {
					next[id] = ms == null ? null : Math.max(0, ms - step);
				}
				remaining = next;
			}
			const due = Object.values(remaining).some((ms) => ms === 0);
			if (due && time >= nextSyncAt) {
				nextSyncAt = time + 1000;
				requestEffectSync();
			}
		}, 250);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

<div class="pack">
	<button class="pack-btn" aria-label="Boost" on:click={onBoost}>
		<img src="/props/logbook.png" alt="" />
		<span>Boost</span>
	</button>

	<button
		class="pack-btn"
		disabled={cooldown != null}
		aria-expanded={open}
		aria-controls={open ? 'effect-inventory' : undefined}
		aria-label={packAriaLabel(open, cooldown)}
		on:click={toggle}
	>
		<img src={open ? '/props/backpack-open.png' : '/props/backpack.png'} alt="" />
		<span>Pack</span>
		{#if cooldown}
			<span class="cooldown">{cooldown}</span>
		{/if}
	</button>

</div>

{#if open}
	<Modal bind:showModal={open}>
		<h2 class="modal-title">Contents of your pack</h2>
		<div class="inventory modal" id="effect-inventory" role="group" aria-label="Contents of your pack">
			{@render slots()}
		</div>
	</Modal>
{/if}

{#snippet slots()}
	{#each effects as effect (effect.id)}
		{@const view = views[effect.id]}
		{@const unlocked = view?.unlocked === true}
		{@const left = view?.seconds ?? null}
		<button
			class="slot"
			disabled={!unlocked}
			aria-label={unlocked
				? `Send ${effect.label}`
				: left == null
					? `${effect.label} recharging`
					: `${effect.label} recharging, ${left} seconds`}
			on:click={() => useEffect(effect)}
		>
			<img
				class="prop {effect.id}"
				src={effect.prop.src}
				alt=""
				aria-hidden="true"
				style="--h: {effect.prop.h}px; --x: {effect.prop.x}%; --sink: {effect.prop.sink}px"
			/>
			<span class="slot-label">{effect.label}</span>
			{#if !unlocked}
				<span class="cooldown">{left == null ? 'Wait' : `${left}s`}</span>
			{/if}
		</button>
	{/each}
{/snippet}

<svelte:window on:keydown={onKeydown} />

<style>
	.pack {
		position: relative;
		flex: 0 1 auto;
		width: fit-content;
		max-width: 100%;
		min-width: 0;
		height: 100%;
		display: flex;
		align-items: stretch;
		justify-content: center;
		gap: 12px;
		overflow: hidden;
	}

	.pack-btn {
		position: relative;
		height: 100%;
		width: clamp(132px, 16vw, 190px);
		margin: 0;
		padding: 6px 8px 4px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 0;
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
		font-size: clamp(15px, 1.5vw, 22px);
		line-height: 1;
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
		flex: 0 0 auto;
		cursor: pointer;
		transition: transform 0.08s ease, border-color 0.08s ease;
	}

	.pack-btn img {
		flex: 1;
		min-height: 0;
		width: auto;
		max-width: 100%;
		object-fit: contain;
		image-rendering: pixelated;
		filter: drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45));
		pointer-events: none;
	}

	.pack-btn span {
		position: relative;
		z-index: 1;
	}

	.pack-btn:hover:not(:disabled),
	.pack-btn[aria-expanded='true']:not(:disabled) {
		border-color: #c8904f;
	}

	.pack-btn:active:not(:disabled) {
		transform: translateY(1px);
	}

	.pack-btn:disabled {
		cursor: not-allowed;
		filter: grayscale(0.65);
		opacity: 0.72;
	}

	.pack-btn:focus-visible {
		outline: 3px solid #ffe14a;
		outline-offset: 5px;
	}

	.modal-title {
		margin: 0 0 16px;
		color: #fbf0d9;
		font-family: var(--font-pixel);
		font-size: 28px;
		font-weight: 600;
		line-height: 1.2;
	}

	.inventory {
		position: relative;
		flex: 0 1 auto;
		width: 100%;
		min-width: 0;
		height: auto;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 12px;
		box-sizing: border-box;
	}

	.slot {
		position: relative;
		height: 150px;
		width: 100%;
		margin: 0;
		padding: 4px 4px 6px;
		overflow: hidden;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
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
		font-size: clamp(16px, 1.5vw, 20px);
		line-height: 1.1;
		-webkit-text-stroke: 3px #000;
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

	.slot span {
		position: relative;
		z-index: 1;
		display: block;
		max-width: 100%;
		text-align: center;
	}

	.slot:hover:not(:disabled) {
		border-color: #c8904f;
	}

	.slot:active:not(:disabled) {
		transform: translateY(1px);
	}

	.slot:focus-visible {
		outline: 3px solid #ffe14a;
		outline-offset: 4px;
	}

	.slot:disabled {
		cursor: not-allowed;
		filter: grayscale(0.65);
		opacity: 0.72;
	}

	.cooldown {
		color: #ffe14a;
	}

	.prop {
		position: absolute;
		left: var(--x);
		top: 2px;
		height: min(var(--h), 58%);
		width: auto;
		max-width: 88%;
		transform: translateX(-50%);
		transform-origin: center bottom;
		pointer-events: none;
		image-rendering: pixelated;
		filter: drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45));
		transition: transform 0.28s ease, filter 0.28s ease;
	}

	.prop.wide {
		transform-origin: 48% 90%;
	}

	.prop.festoons,
	.prop.discoball {
		transform-origin: 50% 6%;
	}

	.slot:hover:not(:disabled) .prop.wide,
	.slot:focus-visible:not(:disabled) .prop.wide {
		animation: prop-wide 1.5s ease-in-out infinite;
	}

	.slot:hover:not(:disabled) .prop.dj,
	.slot:focus-visible:not(:disabled) .prop.dj {
		animation: prop-dj 0.62s ease-in-out infinite;
	}

	.slot:hover:not(:disabled) .prop.festoons,
	.slot:focus-visible:not(:disabled) .prop.festoons {
		animation: prop-festoons 1.15s ease-in-out infinite;
	}

	.slot:hover:not(:disabled) .prop.bubbles,
	.slot:focus-visible:not(:disabled) .prop.bubbles {
		animation: prop-bubbles 1.7s ease-in-out infinite;
	}

	.slot:hover:not(:disabled) .prop.fence,
	.slot:focus-visible:not(:disabled) .prop.fence {
		animation: prop-fence 0.9s steps(3) infinite;
	}

	.slot:hover:not(:disabled) .prop.discoball,
	.slot:focus-visible:not(:disabled) .prop.discoball {
		animation: prop-discoball 1.4s ease-in-out infinite;
	}

	@keyframes prop-wide {
		0%,
		100% {
			transform: translateX(-50%) rotate(-8deg);
		}
		50% {
			transform: translateX(-50%) rotate(10deg);
		}
	}

	@keyframes prop-dj {
		0%,
		100% {
			transform: translateX(-50%) translateY(0) rotate(0deg);
		}
		22% {
			transform: translateX(-50%) translateY(-8px) rotate(-2deg);
		}
		44% {
			transform: translateX(-50%) translateY(0) rotate(0deg);
		}
		62% {
			transform: translateX(-50%) translateY(-4px) rotate(2deg);
		}
		80% {
			transform: translateX(-50%) translateY(0) rotate(0deg);
		}
	}

	@keyframes prop-festoons {
		0%,
		100% {
			transform: translateX(-50%) rotate(-5deg);
			filter: drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45)) brightness(1);
		}
		35% {
			transform: translateX(-50%) rotate(1deg);
			filter: drop-shadow(0 0 8px rgba(255, 214, 90, 0.9))
				drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45)) brightness(1.5);
		}
		70% {
			transform: translateX(-50%) rotate(5deg);
			filter: drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45)) brightness(1.15);
		}
	}

	@keyframes prop-bubbles {
		0%,
		100% {
			transform: translateX(-50%) translate(0, 0) scale(1);
		}
		40% {
			transform: translateX(-50%) translate(4px, -14px) scale(1.07);
		}
		72% {
			transform: translateX(-50%) translate(-3px, -5px) scale(1.02);
		}
	}

	@keyframes prop-fence {
		0%,
		100% {
			filter: drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45)) brightness(1) hue-rotate(0deg);
		}
		33% {
			filter: drop-shadow(0 0 8px rgba(255, 90, 220, 0.8))
				drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45)) brightness(1.35) hue-rotate(120deg);
		}
		66% {
			filter: drop-shadow(0 0 8px rgba(90, 230, 255, 0.8))
				drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45)) brightness(1.2) hue-rotate(240deg);
		}
	}

	@keyframes prop-discoball {
		0%,
		100% {
			transform: translateX(-50%) rotate(-6deg);
			filter: drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45)) brightness(1);
		}
		50% {
			transform: translateX(-50%) rotate(6deg);
			filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.9))
				drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45)) brightness(1.4);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.prop {
			animation: none;
			transition: none;
		}
	}

	@media (max-width: 995px) {
		.pack {
			display: contents;
		}

		.pack-btn {
			order: 2;
			flex: 1 1 0;
			min-width: 0;
			height: 110px;
			width: auto;
		}

		.modal-title {
			font-size: 22px;
		}

		.inventory.modal {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.inventory.modal .slot {
			height: 120px;
		}
	}
</style>
