import jwt from 'jsonwebtoken';
import { getAlbyJwtSecret } from './credentials';
import type { AlbyTokenData } from '$lib/types';

export function signAlbyToken(tokenData: AlbyTokenData): string {
	return jwt.sign(tokenData, getAlbyJwtSecret(), { expiresIn: '10d' });
}

export function verifyAlbyToken(token: string): AlbyTokenData {
	return jwt.verify(token, getAlbyJwtSecret()) as AlbyTokenData;
}
