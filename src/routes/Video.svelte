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
	let muted = true;
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

		el.muted = muted;

		if (src.includes('.m3u8')) {
			if (el.canPlayType('application/vnd.apple.mpegurl')) {
				el.src = src;
				startPlayback(el);
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
					startPlayback(el);
				});
			});
			return;
		}

		el.src = src;
		startPlayback(el);
	}

	function startPlayback(el: HTMLVideoElement) {
		el.muted = muted;
		const pending = el.play();
		if (!pending) return;
		void pending.catch((err: unknown) => {
			if (!isNotAllowed(err) || el.muted) return;
			el.muted = true;
			muted = true;
			void el.play().catch(() => {});
		});
	}

	function unmute() {
		const el = player;
		if (!el) return;
		muted = false;
		el.muted = false;
		const pending = el.play();
		if (!pending) return;
		void pending.catch((err: unknown) => {
			if (!isNotAllowed(err)) return;
			el.muted = true;
			muted = true;
		});
	}

	function syncMuted(event: Event) {
		const el = event.currentTarget;
		if (!(el instanceof HTMLVideoElement)) return;
		muted = el.muted;
	}

	function isNotAllowed(err: unknown) {
		return err instanceof DOMException && err.name === 'NotAllowedError';
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
		<div class="media" class:compact={showLiveChapters && (block?.image || block?.artwork)}>
			<video
				class:audio={showLiveChapters && (block?.image || block?.artwork)}
				disableRemotePlayback
				muted={muted}
				autoplay
				playsinline
				controls
				loop
				preload="auto"
				on:playing={syncLivePlaying}
				on:pause={syncLivePlaying}
				on:ended={replayFromStart}
				on:volumechange={syncMuted}
				bind:this={player}
			></video>
			{#if muted && sourceVideo}
				<button class="unmute" type="button" aria-label="Unmute" on:click={unmute}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path
							d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"
						/>
					</svg>
				</button>
			{/if}
		</div>
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

	.media {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.media.compact {
		width: min(100%, 450px);
		height: 50px;
	}

	.unmute {
		position: absolute;
		z-index: 2;
		left: 12px;
		top: 12px;
		width: 42px;
		height: 42px;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.55);
		background-image: none;
		color: #fff;
		box-shadow: none;
	}

	.unmute svg {
		width: 26px;
		height: 26px;
		fill: currentColor;
	}

	.unmute:hover {
		background: rgba(0, 0, 0, 0.78);
		color: #fff;
	}

	.unmute:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}

	.media.compact .unmute {
		left: auto;
		right: 8px;
		top: auto;
		bottom: 9px;
		width: 32px;
		height: 32px;
	}

	.media.compact .unmute svg {
		width: 20px;
		height: 20px;
	}

	.image {
		width: 100%;
		max-width: 450px;
		height: auto;
	}
</style>
