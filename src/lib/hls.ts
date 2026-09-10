export async function loadHls(): Promise<typeof import('hls.js').default> {
	// @ts-expect-error hls.js/light is not in the package type exports
	const { default: HlsPlayer } = await import('hls.js/light');
	return HlsPlayer as typeof import('hls.js').default;
}
