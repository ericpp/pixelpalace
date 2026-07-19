import jwt from 'jsonwebtoken';
import { getAlbyJwtSecret } from './credentials.js';

export function signAlbyToken(tokenData) {
	return jwt.sign(tokenData, getAlbyJwtSecret(), { expiresIn: '10d' });
}

export function verifyAlbyToken(token) {
	return jwt.verify(token, getAlbyJwtSecret());
}
