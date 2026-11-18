import { describe, expect, it, vi } from 'vitest';
import { pressPanelButton, pressesButton, shortcutOf } from '#lib/media/utils/moderationKeys.ts';

/** A key press aimed at an element, which the handler reads the target from. */
function press(key: string, init: KeyboardEventInit = {}, target: HTMLElement = document.body) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, ...init });
	Object.defineProperty(event, 'target', { value: target });
	return event;
}

describe('shortcutOf', () => {
	it.each([
		['j', 'next'],
		['k', 'previous'],
		['Enter', 'panel'],
		['s', 'show'],
		['a', 'approve'],
		['d', 'dismiss'],
		['r', 'restore'],
		['h', 'hide'],
		['x', 'reject'],
		['?', 'help']
	])('reads %s as %s', (key, shortcut) => {
		expect(shortcutOf(press(key, key === '?' ? { shiftKey: true } : {}), true)).toBe(shortcut);
	});

	it('reads u as the account shortcut', () => {
		expect(shortcutOf(press('u'), true)).toBe('account');
	});

	it('does nothing for any other key, a capital letter or a name on the key table’s prototype', () => {
		for (const key of ['z', 'J', 'Escape', 'ArrowDown', 'constructor', 'toString']) {
			expect(shortcutOf(press(key), true)).toBeNull();
		}
	});

	it('does nothing when the setting is off', () => {
		for (const key of ['j', 'a', 'h', '?', 'Enter']) {
			expect(shortcutOf(press(key), false)).toBeNull();
		}
	});

	it.each(['ctrlKey', 'metaKey', 'altKey'] as const)(
		'does nothing while %s is held',
		(modifier) => {
			expect(shortcutOf(press('a', { [modifier]: true }), true)).toBeNull();
			expect(shortcutOf(press('?', { [modifier]: true, shiftKey: true }), true)).toBeNull();
		}
	);

	it('takes Shift only for ?, and does nothing while an input method composes', () => {
		expect(shortcutOf(press('a', { shiftKey: true }), true)).toBeNull();
		expect(shortcutOf(press('?', { shiftKey: true }), true)).toBe('help');
		expect(shortcutOf(press('a', { isComposing: true }), true)).toBeNull();
	});

	it.each([
		['an input', '<input data-target>'],
		['a select', '<select data-target></select>'],
		['a textarea', '<textarea data-target></textarea>'],
		['a contenteditable element', '<div data-target contenteditable="true"></div>'],
		['an element inside a plate', '<form class="plate"><button data-target></button></form>']
	])('does nothing while the focus is in %s', (_name, html) => {
		document.body.innerHTML = html;
		const target = document.body.querySelector<HTMLElement>('[data-target]')!;
		expect(shortcutOf(press('a', {}, target), true)).toBeNull();
		document.body.innerHTML = '';
	});

	it('works from a button, which is not a field', () => {
		const button = document.body.appendChild(document.createElement('button'));
		expect(shortcutOf(press('j', {}, button), true)).toBe('next');
		button.remove();
	});

	it('keeps a contenteditable="false" element out of the exceptions', () => {
		const el = document.body.appendChild(document.createElement('div'));
		el.setAttribute('contenteditable', 'false');
		expect(shortcutOf(press('j', {}, el), true)).toBe('next');
		el.remove();
	});
});

describe('pressPanelButton', () => {
	function panel(html: string) {
		const el = document.createElement('div');
		el.innerHTML = html;
		return el;
	}

	it('presses the button that carries the shortcut’s action', () => {
		const el = panel('<button data-action="approve">Approve</button>');
		const click = vi.fn();
		el.querySelector('button')!.addEventListener('click', click);
		expect(pressPanelButton(el, 'approve')).toBe(true);
		expect(click).toHaveBeenCalledTimes(1);
	});

	it('presses nothing where the button is absent or disabled', () => {
		expect(pressPanelButton(panel(''), 'approve')).toBe(false);
		expect(pressPanelButton(null, 'approve')).toBe(false);
		expect(
			pressPanelButton(panel('<button data-action="approve" disabled></button>'), 'approve')
		).toBe(false);
	});

	it('shows a comment only while it is collapsed', () => {
		const collapsed = panel('<button data-action="reveal" aria-expanded="false"></button>');
		const shown = panel('<button data-action="reveal" aria-expanded="true"></button>');
		expect(pressPanelButton(collapsed, 'show')).toBe(true);
		expect(pressPanelButton(shown, 'show')).toBe(false);
	});

	it('presses nothing for a key that moves or opens', () => {
		const el = panel('<button data-action="approve"></button>');
		expect(pressPanelButton(el, 'next')).toBe(false);
		expect(pressPanelButton(el, 'help')).toBe(false);
	});
});

describe('pressesButton', () => {
	it('is true for the keys that stand for a panel button', () => {
		for (const shortcut of ['show', 'approve', 'dismiss', 'restore', 'hide', 'reject'] as const) {
			expect(pressesButton(shortcut)).toBe(true);
		}
		for (const shortcut of ['next', 'previous', 'panel', 'help'] as const) {
			expect(pressesButton(shortcut)).toBe(false);
		}
	});
});
