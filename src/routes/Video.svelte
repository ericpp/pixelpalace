<script lang="ts">
	import type Hls from 'hls.js';
	import { onMount } from 'svelte';

	import { mainSettings, getEventGuid, getEventSocketUrl } from '$/stores';
	import { loadHls } from '$lib/hls';
	import { connectEventSocket } from '$lib/socket';
	import type { Block } from '$lib/types';

	export let guid = getEventGuid();

	let player: HTMLVideoElement | undefined;
	let block: Block | undefined;
	let hls: Hls | undefined;
	let sourceToken = 0;
	$: sourceVideo = $mainSettings?.liveEnclosure || '';
	// sourceVideo = 'https://listen.noagendastream.com/noagenda';

	$: setSource(sourceVideo, player);

	$: console.log($mainSettings);

	async function setSource(src: string, el?: HTMLVideoElement) {
		console.log(el);
		console.log(src);
		if (!el || !src) return;

		const token = ++sourceToken;
		hls?.destroy();
		hls = undefined;

		// src =
		// 	'https://noagendatube.com/static/streaming-playlists/hls/54ebb881-8581-4b16-b3ba-04dcac230fd4/master.m3u8';

		// src = 'https://content.jwplatform.com/manifests/yp34SRmf.m3u8';
		console.log(src);
		if (src.includes('.m3u8')) {
			if (el.canPlayType('application/vnd.apple.mpegurl')) {
				el.src = src;
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
					el.play();
				});
			});
			return;
		}

		el.src = src;
		el.play();
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

		return () => {
			sourceToken += 1;
			hls?.destroy();
			hls = undefined;
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
			preload="metadata"
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
		overflow: hidden;
	}
	.player {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		overflow: hidden;
	}

	video {
		max-width: 100%;
		max-height: 100%;
		width: auto;
		height: auto;
		object-fit: contain;
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
