/**
 * The form value that carries a comment's `editedAt` from a moderation view back to the server:
 * the time in milliseconds, or empty for a comment never edited. An action that makes the comment
 * public is refused when the stored value differs (`viewedEditedAt`, `moderation-action.ts`).
 */
export function editedAtValue(editedAt: string | null): string {
	return editedAt === null ? '' : String(Date.parse(editedAt));
}
