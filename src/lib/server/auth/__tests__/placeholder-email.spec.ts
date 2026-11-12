import { describe, it, expect } from 'vitest';
import { isPlaceholderEmail, placeholderEmail, realEmail } from '../placeholder-email.ts';

describe('placeholder email', () => {
	it('builds <id>@users.invalid and recognises it in any case', () => {
		expect(placeholderEmail('abc')).toBe('abc@users.invalid');
		expect(isPlaceholderEmail('abc@users.invalid')).toBe(true);
		expect(isPlaceholderEmail('ABC@Users.Invalid')).toBe(true);
	});

	it('does not match a real address or a look-alike domain', () => {
		expect(isPlaceholderEmail('mary@example.com')).toBe(false);
		expect(isPlaceholderEmail('mary@notusers.invalid')).toBe(false);
		expect(isPlaceholderEmail('users.invalid@example.com')).toBe(false);
	});

	it('realEmail hides the placeholder and keeps a real address', () => {
		expect(realEmail({ email: 'abc@users.invalid' })).toBeNull();
		expect(realEmail({ email: 'mary@example.com' })).toBe('mary@example.com');
	});
});
