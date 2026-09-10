import type { Socket } from 'socket.io-client';

export async function connectEventSocket(url: string): Promise<Socket> {
	const { default: io } = await import('socket.io-client');
	return io(url);
}
