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
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
	}

	iframe {
		width: calc(100% - 6px);
		border: none;
		flex-grow: 1;
	}
</style>
