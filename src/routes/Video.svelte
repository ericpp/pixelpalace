<script lang="ts">
	import type Hls from 'hls.js';
	import { onMount } from 'svelte';

	import {
		mainSettings,
		getEventGuid,
		getEventSocketUrl,
		isLiveEnabled,
		isPlaceholderVideoEnabled,
		getPlaceholderVideoUrl
	} from '$/stores';
	import { loadHls } from '$lib/hls';
	import { connectEventSocket } from '$lib/socket';
	import { setLivePlaying } from '$lib/liveSocket';
	import type { Block } from '$lib/types';

	const liveEnabled = isLiveEnabled();
	const placeholderEnabled = isPlaceholderVideoEnabled();
	const placeholderVideo = getPlaceholderVideoUrl();

	export let guid = getEventGuid();

	let player: HTMLVideoElement | undefined;
	let block: Block | undefined;
	let hls: Hls | undefined;
	let sourceToken = 0;
	$: sourceVideo = $mainSettings?.liveEnclosure || (placeholderEnabled ? placeholderVideo : '');
	// sourceVideo = 'https://listen.noagendastream.com/noagenda';

	$: setSource(sourceVideo, player);

	$: console.log($mainSettings);

	async function setSource(src: string, el?: HTMLVideoElement) {
		console.log(el);
		console.log(src);
		if (!el) return;

		const token = ++sourceToken;
		hls?.destroy();
		hls = undefined;

		if (!src) {
			el.removeAttribute('src');
			el.load();
			return;
		}
		if (src.includes('.m3u8')) {
			if (el.canPlayType('application/vnd.apple.mpegurl')) {
				el.src = src;
				void el.play().catch(() => {});
				return;
			}

			const HlsPlayer = await loadHls();
			if (token !== sourceToken || !HlsPlayer.isSupported()) return;

			console.log('hello hls.js!');
			const instance = new HlsPlayer();
			hls = instance;
			instance.attachMedia(el);
			instance.on(HlsPlayer.Events.MEDIA_ATTACHED, function () {
				if (token !== sourceToken) return;
				console.log('video and hls.js are now bound together !');
				instance.loadSource(src);
				instance.on(HlsPlayer.Events.MANIFEST_PARSED, function (_event, data) {
					console.log('manifest loaded, found ' + data.levels.length + ' quality level');
					void el.play().catch(() => {});
				});
			});
			return;
		}

		el.src = src;
		el.play();
	}

	function replayFromStart() {
		if (!player) return;
		player.currentTime = 0;
		hls?.startLoad();
		void player.play();
	}

	function syncLivePlaying() {
		if (!liveEnabled) return;
		const active = Boolean(
			player && !player.paused && !player.ended && document.visibilityState === 'visible'
		);
		setLivePlaying(active);
	}

	onMount(() => {
		const url = getEventSocketUrl(guid);
		const socketPromise = connectEventSocket(url);

		socketPromise.then((liveItemSocket) => {
			liveItemSocket.on('remoteValue', function (data: Block) {
				block = data;
			});
			liveItemSocket.on('playerPause', function (data: unknown) {
				// You will need to adjust this part based on the actual format of the data sent by the server
				console.log(data);
			});
		});

		if (liveEnabled) {
			player?.addEventListener('playing', syncLivePlaying);
			player?.addEventListener('pause', syncLivePlaying);
			player?.addEventListener('ended', syncLivePlaying);
			document.addEventListener('visibilitychange', syncLivePlaying);
			syncLivePlaying();
		}

		return () => {
			sourceToken += 1;
			hls?.destroy();
			hls = undefined;
			if (liveEnabled) {
				setLivePlaying(false);
				player?.removeEventListener('playing', syncLivePlaying);
				player?.removeEventListener('pause', syncLivePlaying);
				player?.removeEventListener('ended', syncLivePlaying);
				document.removeEventListener('visibilitychange', syncLivePlaying);
			}
			socketPromise.then((socket) => socket.disconnect());
		};
	});

	$: showLiveChapters = $mainSettings?.liveStreamType === 'audio' || !$mainSettings?.liveStreamType;
</script>

<container>
	{#if showLiveChapters && (block?.image || block?.artwork)}
		<img
			class="image"
			src={block?.image || block?.artwork || ''}
			alt="live artwork"
			width="300"
			height="300"
		/>
	{/if}
	<div class="player">
		<video
			class:audio={showLiveChapters && (block?.image || block?.artwork)}
			disableRemotePlayback
			playsinline
			controls
			loop
			preload="metadata"
			on:playing={syncLivePlaying}
			on:pause={syncLivePlaying}
			on:ended={replayFromStart}
			bind:this={player}
		></video>
	</div>
</container>

<style>
	container {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}
	.player {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		position: relative;
		background: #000;
	}

	video {
		max-width: 100%;
		max-height: 100%;
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: #000;
	}
	.audio {
		height: 50px;
		width: 100%;
		max-width: 450px;
	}

	.image {
		width: 100%;
		max-width: 450px;
		height: auto;
	}
</style>
