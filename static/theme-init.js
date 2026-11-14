try {
	// `midb_hint` (session.svelte.ts) marks a probably signed-in reader, so the comment
	// section reserves the composer's height in the first paint.
	if (/(?:^|;\s*)midb_hint=1(?:;|$)/.test(document.cookie)) {
		document.documentElement.dataset.hint = 'user';
	}
} catch {
	// Cookies unreadable: no hint, and the comment section reserves no composer height.
}
try {
	var t = localStorage.getItem('theme');
	if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
	// Tint the mobile browser chrome with the active theme's --surface
	// (#fbfafc light, #141217 dark). Resolve a manual override first,
	// else follow the system preference
	var dark =
		t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	var meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.setAttribute('content', dark ? '#141217' : '#fbfafc');
} catch {
	// Storage unavailable: the page follows the system theme.
}
