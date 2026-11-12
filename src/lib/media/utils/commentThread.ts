import type { CommentView, OwnComment } from '#lib/media/types/comments.ts';
import type { PublicUser } from '#lib/media/types/user.ts';

/** What an author's own unpublished comment shows: its state and, once rejected, the reason. */
export type ReviewState = { status: 'pending' | 'rejected'; reason: string | null };

/** A comment as the section draws it: the public view, plus the review state on the reader's own. */
export type ShownComment = Omit<CommentView, 'replies'> & { review: ReviewState | null };

/** A root and its one rendered level of replies, oldest first. */
export type Thread = { root: ShownComment; replies: ShownComment[] };

const asShown = (view: CommentView): ShownComment => {
	const { replies: _replies, ...rest } = view;
	return { ...rest, review: null };
};

function ownAsShown(own: OwnComment, me: PublicUser, names: Map<string, string>): ShownComment {
	const answered = own.parentId && own.parentId !== own.rootId ? own.parentId : null;
	const name = answered ? names.get(answered) : undefined;
	return {
		id: own.id,
		parentId: own.parentId,
		rootId: own.rootId,
		inReplyTo: answered && name ? { id: answered, displayName: name } : null,
		removed: false,
		body: own.body,
		author: me,
		score: 0,
		replyCount: 0,
		createdAt: own.createdAt,
		editedAt: own.editedAt,
		review: {
			status: own.status === 'rejected' ? 'rejected' : 'pending',
			reason: own.moderationReason
		}
	};
}

const byAge = (a: ShownComment, b: ShownComment) =>
	a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1;

/**
 * The list the section draws: the public page's threads, with the reader's own pending and
 * rejected comments merged in (the public list never carries them). An own comment that is
 * also in the public list, as the placeholder of an edited comment that has replies, replaces
 * that placeholder in place. Any other own root goes first, newest first; an own reply joins its
 * root's thread by age; an own reply whose root is not on the loaded pages stands as a thread
 * of its own at the top.
 */
export function buildThreads(
	list: readonly CommentView[],
	own: readonly OwnComment[],
	me: PublicUser | null
): Thread[] {
	if (!me || own.length === 0) {
		return list.map((root) => ({ root: asShown(root), replies: root.replies.map(asShown) }));
	}

	const names = new Map<string, string>();
	for (const view of list) {
		if (view.author) names.set(view.id, view.author.displayName);
		for (const reply of view.replies) {
			if (reply.author) names.set(reply.id, reply.author.displayName);
		}
	}
	const ownById = new Map(own.map((c) => [c.id, ownAsShown(c, me, names)]));
	const placed = new Set<string>();
	const take = (view: CommentView): ShownComment => {
		const mine = ownById.get(view.id);
		if (mine) placed.add(view.id);
		return mine ?? asShown(view);
	};

	const threads: Thread[] = list.map((root) => ({
		root: take(root),
		replies: root.replies.map(take)
	}));
	const byRoot = new Map(threads.map((t) => [t.root.id, t]));
	const unplaced = [...ownById.values()].filter((c) => !placed.has(c.id));
	const ownRoots = unplaced.filter((c) => c.parentId === null);
	for (const root of ownRoots) byRoot.set(root.id, { root, replies: [] });

	const strays: Thread[] = [];
	for (const reply of unplaced.filter((c) => c.parentId !== null)) {
		const thread = byRoot.get(reply.rootId ?? reply.parentId ?? '');
		if (thread) thread.replies = [...thread.replies, reply].sort(byAge);
		else strays.push({ root: reply, replies: [] });
	}
	return [...ownRoots.map((root) => byRoot.get(root.id) as Thread), ...strays, ...threads];
}
