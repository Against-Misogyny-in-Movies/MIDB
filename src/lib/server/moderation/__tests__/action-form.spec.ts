import { describe, expect, it, vi } from 'vitest';

vi.mock('#lib/server/data/moderation-actions.ts', () => ({ muteUser: vi.fn() }));

const { muteUser } = await import('#lib/server/data/moderation-actions.ts');
const { muteFromForm, ruleOf, withRule } = await import('../action-form.ts');

const form = (fields: Record<string, string>) => {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
};

describe('ruleOf', () => {
	it('reads a rule from the list and nothing else', () => {
		expect(ruleOf(form({ rule: 'harassment' }))).toBe('harassment');
		expect(ruleOf(form({ rule: ' other ' }))).toBe('other');
		expect(ruleOf(form({ rule: 'misogyny' }))).toBeNull();
		expect(ruleOf(form({ rule: '' }))).toBeNull();
		expect(ruleOf(form({}))).toBeNull();
	});
});

describe('withRule', () => {
	it('runs with a valid rule and refuses a missing or unknown one as invalid', async () => {
		const run = vi.fn(() => ({ ok: true as const, extra: {} }));
		expect(await withRule(form({ rule: 'spam' }), run)).toEqual({ ok: true, extra: {} });
		expect(run).toHaveBeenCalledWith('spam');
		run.mockClear();
		expect(await withRule(form({}), run)).toEqual({ ok: false, reason: 'invalid' });
		expect(await withRule(form({ rule: 'nope' }), run)).toEqual({ ok: false, reason: 'invalid' });
		expect(run).not.toHaveBeenCalled();
	});
});

describe('muteFromForm', () => {
	const staff = { id: 'mod', role: 'moderator' } as never;

	it('needs a listed length and a rule', async () => {
		vi.mocked(muteUser).mockResolvedValue({ ok: true, title: null });
		expect(await muteFromForm(staff, form({ userId: 'u1', hours: '24' }))).toEqual({
			ok: false,
			reason: 'invalid'
		});
		expect(await muteFromForm(staff, form({ userId: 'u1', hours: '5', rule: 'spam' }))).toEqual({
			ok: false,
			reason: 'invalid'
		});
		expect(muteUser).not.toHaveBeenCalled();
		await muteFromForm(
			staff,
			form({ userId: 'u1', hours: '168', rule: 'trolling', reason: ' x ' })
		);
		expect(muteUser).toHaveBeenCalledWith(staff, 'u1', 168, 'x', 'trolling');
	});
});
