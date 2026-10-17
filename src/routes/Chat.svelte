<script lang="ts">
	import { mainSettings } from '$/stores';
</script>

<div class="chat">
	<iframe title="Live chat" src={$mainSettings?.liveChatEnclosure || ''}></iframe>
</div>

<style>
	div {
		width: 100%;
		height: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		position: relative;
		background-color: var(--wood-dark);
	}

	iframe {
		width: 100%;
		height: 100%;
		border: none;
		flex-grow: 1;
		background-color: var(--wood-dark);
	}
</style>
