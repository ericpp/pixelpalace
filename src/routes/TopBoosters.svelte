<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { startBoostBoard, testBoost, topBoosters } from '$lib/boostBoard';
	import { getBoardSettings, isBoardConfigured } from '$/stores';

	const slots = [
		{ width: 100 },
		{ width: 96 },
		{ width: 100 },
		{ width: 94 },
		{ width: 100 },
		{ width: 97 }
	];

	onMount(() => {
		if (import.meta.env.DEV) {
			(
				window as Window & { testBoost?: (name: string, sats: number) => void }
			).testBoost = testBoost;
		}

		const settings = getBoardSettings($page.data.boardScope);
		if (!isBoardConfigured(settings)) {
			return () => {
				if (import.meta.env.DEV) {
					delete (window as Window & { testBoost?: (name: string, sats: number) => void }).testBoost;
				}
			};
		}

		const stop = startBoostBoard({ ...settings, slots: slots.length });
		return () => {
			stop();
			if (import.meta.env.DEV) {
				delete (window as Window & { testBoost?: (name: string, sats: number) => void }).testBoost;
			}
		};
	});
</script>

<section class="signpost" aria-label="Top boosters">
	<div class="post" aria-hidden="true"></div>
	<div class="boards">
		<div class="plank title">
			<span class="nail"></span>
			<span class="title-text">Top Boosters</span>
		</div>
		{#each slots as slot, i (i)}
			{@const score = $topBoosters[i]}
			<div class="plank arrow" style="--w: {slot.width}">
				<span class="nail"></span>
				{#if score}
					<span class="name" title={score.name}>{score.name}</span>
					<span class="sats">{score.sats.toLocaleString()}</span>
				{/if}
			</div>
		{/each}
	</div>
</section>

<style>
	.signpost {
		position: relative;
		height: 100%;
		min-height: 0;
		width: 100%;
		container-type: inline-size;
	}

	.post {
		position: absolute;
		left: 34px;
		top: 0;
		bottom: 0;
		width: 24px;
		box-sizing: border-box;
		border: 3px solid var(--wood-outline);
		background-color: var(--wood-mid);
		background-image:
			linear-gradient(90deg, rgba(255, 210, 150, 0.22) 0 30%, transparent 30% 70%, rgba(0, 0, 0, 0.35) 70%),
			repeating-linear-gradient(180deg, transparent 0 34px, rgba(0, 0, 0, 0.3) 34px 37px);
		box-shadow: 4px 0 0 rgba(0, 0, 0, 0.3);
	}

	.boards {
		position: relative;
		z-index: 1;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 6px 0 10px;
		box-sizing: border-box;
		/* Clip-path cuts off borders, so the pixel outline is drawn around the stacked planks instead */
		filter: drop-shadow(3px 0 0 var(--wood-outline)) drop-shadow(-3px 0 0 var(--wood-outline))
			drop-shadow(0 3px 0 var(--wood-outline)) drop-shadow(0 -3px 0 var(--wood-outline))
			drop-shadow(4px 5px 0 rgba(0, 0, 0, 0.35));
	}

	.plank {
		--shape: polygon(0 0, 100% 0, 100% 100%, 0 100%);
		--rim: 4px;
		position: relative;
		display: flex;
		align-items: center;
		color: #fff8ea;
		background-image: url('/plank.png');
		clip-path: var(--shape);
		font-family: var(--font-pixel);
		font-weight: 600;
		-webkit-text-stroke: 1px #000;
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

	.plank::before {
		content: '';
		position: absolute;
		inset: var(--rim);
		clip-path: var(--shape);
	}

	.title {
		margin-left: 6px;
		width: 92%;
		min-height: 50px;
		justify-content: center;
		padding: 6px 12px 6px 24px;
		box-sizing: border-box;
		font-size: clamp(18px, 7cqi, 22px);
		line-height: 1;
		text-align: center;
	}

	.title-text {
		position: relative;
		z-index: 1;
		text-transform: uppercase;
	}

	.arrow {
		--shape: polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%);
		margin-left: 12px;
		width: calc(var(--w) * 1%);
		height: clamp(54px, 9vh, 66px);
		padding: 4px 34px 4px 28px;
		box-sizing: border-box;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 1px;
		font-size: clamp(18px, 6.5cqi, 21px);
		line-height: 1.05;
	}

	.name,
	.sats {
		position: relative;
		z-index: 1;
		max-width: 100%;
	}

	.name {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.sats {
		color: #ffe14a;
		font-size: 1em;
	}

	.nail {
		position: absolute;
		left: 14px;
		top: 50%;
		width: 6px;
		height: 6px;
		margin-top: -3px;
		z-index: 1;
		background: #9a9a9a;
		box-shadow:
			0 0 0 2px var(--wood-outline),
			1px 1px 0 2px #2b2b2b;
	}

	.title .nail {
		left: 12px;
	}
</style>
