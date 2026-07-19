export async function fetchAlbyUser(accessToken) {
	const headers = { Authorization: `Bearer ${accessToken}` };

	const [accountRes, balanceRes] = await Promise.all([
		fetch('https://api.getalby.com/user/value4value', { headers }),
		fetch('https://api.getalby.com/balance', { headers })
	]);

	if (!accountRes.ok || !balanceRes.ok) {
		const accountText = accountRes.ok ? '' : await accountRes.text();
		const balanceText = balanceRes.ok ? '' : await balanceRes.text();
		console.log('Alby user fetch error:', accountText, balanceText);
		throw new Error('Failed to fetch Alby user data');
	}

	const account = await accountRes.json();
	const balance = await balanceRes.json();

	return { ...account, ...balance };
}
