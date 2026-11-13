import type { ViewerReportView } from '#lib/media/types/community-reports.ts';
import type { PublicUser } from '#lib/media/types/user.ts';
import { vi } from 'vitest';

export const ME: PublicUser = {
	id: 'me',
	username: 'mary',
	avatarKey: null,
	role: 'user',
	displayName: 'mary'
};

export const BASE = '/api/titles/movie/603/reports';

export type Handler = (init?: RequestInit) => Response | Promise<Response>;
export const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function api(routes: Record<string, Handler>) {
	return vi.fn(async (input: string, init?: RequestInit) => {
		const handler = routes[`${init?.method ?? 'GET'} ${input.split('?')[0]}`];
		return handler ? handler(init) : json({ message: 'Not found' }, 404);
	});
}

const flags = Object.fromEntries(
	[
		'rapeMenDisImp',
		'sexHarOnScrn',
		'sexAdultTeen',
		'childSexAbuse',
		'incest',
		'attemptedRape',
		'rapeOffScrn',
		'rapeOnScreen'
	].map((k) => [k, { yes: k === 'incest' ? 2 : 0, no: 1, unsure: 0 }])
);

export const COUNTS = {
	total: 7,
	categories: {
		sexual: { present: 5, none: 2 },
		partner: { none: 6, mentioned: 1 },
		physical: { on_screen: 4, mentioned: 1, none: 2 },
		stalking: { none: 7 },
		objectification: { some_scenes: 3, none: 4 }
	},
	flags,
	framing: { condemned: 3, unclear: 0, played_for_laughs: 0, glamorised_or_justified: 0 }
};

export function stored(over: Partial<ViewerReportView> = {}): ViewerReportView {
	return {
		sexualPresent: 'none',
		partnerLevel: null,
		physicalLevel: null,
		stalkingLevel: null,
		objectificationLevel: null,
		framing: null,
		status: 'counted',
		holdReason: null,
		createdAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-01T00:00:00.000Z',
		countsFrom: '2026-10-08T00:00:00.000Z',
		...over
	} as unknown as ViewerReportView;
}

export const counts =
	(body: unknown = COUNTS): Handler =>
	() =>
		json(body);
export const viewer = (
	report: ViewerReportView | null,
	mutedUntil: string | null = null
): Handler => {
	return () => json({ report, mutedUntil });
};
