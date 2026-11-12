import type { CommentStatus, ModerationSource } from '#lib/media/types/comments.ts';
import type { TitleKind } from '#lib/server/data/title-queries.ts';

export interface DecideInput {
	body: string;
	titleName: string;
	kind: TitleKind;
	/** The body of the comment being answered, when this is a reply. */
	parentBody?: string;
}

/** What a new or edited comment is stored as. */
export interface Decision {
	status: Extract<CommentStatus, 'pending' | 'published' | 'rejected'>;
	source: ModerationSource | null;
	reason: string | null;
	/** The classifier's verdict as JSON text, when one ran. */
	aiVerdict: string | null;
}

/**
 * The single place that decides what status a new or edited comment starts in. Until the AI
 * moderation phase it holds every comment for a moderator: `pending`, with no source.
 */
export function decideStatus(_input: DecideInput): Promise<Decision> {
	return Promise.resolve({ status: 'pending', source: null, reason: null, aiVerdict: null });
}
