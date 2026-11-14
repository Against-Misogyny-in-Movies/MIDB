import type { OwnProfile } from '#lib/media/types/profile.ts';
import type { Fetcher } from '#lib/media/utils/commentApi.ts';

export type OwnProfilePhase = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The owner's private view of their profile, fetched from `GET /api/me/profile` once the client
 * session says the reader owns the page. The cached page never carries it, so it loads after the
 * first paint; until it is ready the page shows what a visitor sees.
 */
export class OwnProfileState {
	phase = $state<OwnProfilePhase>('idle');
	data = $state<OwnProfile | null>(null);

	readonly #fetcher: Fetcher;

	constructor(fetcher: Fetcher = (input, init) => fetch(input, init)) {
		this.#fetcher = fetcher;
	}

	async load(): Promise<void> {
		if (this.phase === 'loading') return;
		this.phase = 'loading';
		try {
			const response = await this.#fetcher('/api/me/profile', { cache: 'no-store' });
			if (!response.ok) throw new Error(String(response.status));
			this.data = (await response.json()) as OwnProfile;
			this.phase = 'ready';
		} catch {
			this.phase = 'error';
		}
	}
}
