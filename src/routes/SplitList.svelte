<script lang="ts">
	import type { SplitStatus } from '$lib/types';

	export let rows: Array<{
		name?: string;
		destIndex?: number;
		amount?: number;
		split?: string | number;
	}> = [];
	export let statuses: Record<number, SplitStatus> = {};
	export let isZap = false;

	function splitRowIndex(person: { destIndex?: number }, fallback: number): number {
		return person.destIndex ?? fallback;
	}

	function splitRowValue(person: { amount?: number; split?: string | number }): string | number {
		if (isZap && person.amount != null) return person.amount;
		return person.split ?? '';
	}
</script>

<header>
	<p>Name</p>
	<p>{isZap ? 'Sats' : 'Split'}</p>
</header>
<ul>
	{#each rows as person, i}
		{@const destIndex = splitRowIndex(person, i)}
		<li>
			<p class="split-name">
				<span
					class="split-status"
					class:success={statuses[destIndex] === 'success'}
					class:failed={statuses[destIndex] === 'failed'}
					aria-hidden={!(statuses[destIndex] === 'success' || statuses[destIndex] === 'failed')}
				>
					{#if statuses[destIndex] === 'success'}
						✓
					{:else if statuses[destIndex] === 'failed'}
						✗
					{/if}
				</span>
				{person.name}
			</p>
			<p>{splitRowValue(person)}</p>
		</li>
	{/each}
</ul>

<style>
	p {
		text-align: center;
		font-weight: 600;
		color: white;
		font-size: 1em;
	}

	header {
		display: flex;
		justify-content: space-between;
		margin: 0 8px;
	}

	header > p {
		margin: 0;
		padding: 0;
		text-decoration: underline;
	}

	ul {
		padding: 8px;
		height: calc(100% - 32px);
		overflow: auto;
		margin: 0;
	}

	li {
		list-style: none;
		padding: 0 8px;
		display: flex;
		justify-content: space-between;
	}

	li > p {
		padding: 0;
		margin: 4px 0;
	}

	.split-name {
		display: flex;
		align-items: center;
		gap: 6px;
		text-align: left;
	}

	.split-status {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1em;
		min-width: 1em;
		font-weight: 700;
		line-height: 1;
	}

	.split-status.success {
		color: #3dd68c;
	}

	.split-status.failed {
		color: #ff5c5c;
	}
</style>
