import type { Block, BoostPayment, BuildBoostPaymentsArgs, Destination } from '$lib/types';

function getBaseRecord(block: Block, satAmount: number, boostagram: string, senderName: string) {
	return {
		podcast: block.title,
		action: 'boost',
		app_name: 'The Split Kit',
		value_msat: 0,
		value_msat_total: satAmount * 1000,
		name: undefined as string | undefined,
		message: boostagram,
		sender_name: senderName || 'anonymous ',
		remoteFeedGuid: block.feedGuid,
		remoteItemGuid: block.itemGuid,
		eventGuid: block.eventGuid,
		blockGuid: block?.blockGuid,
		eventAPI: block.eventAPI
	};
}

function buildPaymentPayload(
	block: Block,
	dest: Destination,
	satAmount: number,
	boostagram: string,
	senderName: string,
	amount: number
): BoostPayment {
	const record = getBaseRecord(block, satAmount, boostagram, senderName);
	record.name = dest.name;
	record.value_msat = amount * 1000;

	const customRecords: Record<string, string> = { '7629169': JSON.stringify(record) };
	if (dest.customKey != null && dest.customValue != null) {
		customRecords[String(dest.customKey)] = String(dest.customValue);
	}

	let type = dest.type;
	if (dest.address.includes('@')) {
		type = 'lnaddress';
	}

	return {
		type,
		destination: dest.address,
		amount,
		customRecords,
		name: dest.name,
		destIndex: dest.destIndex
	};
}

/** Build per-destination split payments from a value block. */
export default function buildBoostPayments({
	block,
	satAmount,
	boostagram,
	senderName,
	isDefault
}: BuildBoostPaymentsArgs): BoostPayment[] {
	const destinations = (block?.value?.destinations || []).map((dest, destIndex) => ({
		...dest,
		destIndex
	}));
	const feesDestinations = destinations.filter((v) => v.fee);
	const splitsDestinations = destinations.filter((v) => !v.fee);

	const splitKitObject = {
		name: 'The Split Kit',
		address: '035ad2c954e264004986da2d9499e1732e5175e1dcef2453c921c6cdcc3536e9d8',
		type: 'node',
		split: '5',
		fee: true
	};

	if (
		!feesDestinations.some(
			(item) =>
				item.customKey === (splitKitObject as { customKey?: string }).customKey &&
				item.customValue === (splitKitObject as { customValue?: string }).customValue &&
				item.address === splitKitObject.address
		) &&
		!isDefault
	) {
		// Split Kit fee destination is optional and currently disabled.
	}

	const payments: BoostPayment[] = [];
	let runningTotal = satAmount;

	for (const dest of feesDestinations) {
		const amount = Math.round((Number(dest.split) / 100) * satAmount);
		if (amount) {
			runningTotal -= amount;
			payments.push(buildPaymentPayload(block, dest, satAmount, boostagram, senderName, amount));
		}
	}

	for (const dest of splitsDestinations) {
		const amount = Math.round((Number(dest.split) / 100) * runningTotal);
		if (amount >= 1) {
			payments.push(buildPaymentPayload(block, dest, satAmount, boostagram, senderName, amount));
		}
	}

	return payments;
}
