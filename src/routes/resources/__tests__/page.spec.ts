import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Page from '../+page.svelte';
import {
	BURST_COUNT,
	BURST_WINDOW_HOURS,
	NEW_ACCOUNT_DAYS,
	NEW_ACCOUNT_REPORT_MAX,
	COMMUNITY_REPORT_MIN,
	REPORT_ACCOUNT_MIN_AGE_DAYS
} from '#lib/media/utils/communityReports.ts';

describe('Methodology, community reports', () => {
	const section = () => {
		const { container } = render(Page);
		return container.querySelector<HTMLElement>('#community-reports');
	};

	it('renders the section the title page links to', () => {
		const el = section();
		expect(el).toBeTruthy();
		expect(el?.querySelector('h2')?.textContent).toBe('MIDB community reports');
	});

	it('states the thresholds from the shared constants', () => {
		const text = (section()?.textContent ?? '').replace(/\s+/g, ' ');
		expect(text).toContain(`${REPORT_ACCOUNT_MIN_AGE_DAYS} days old`);
		expect(text).toContain(`once ${COMMUNITY_REPORT_MIN} reports count`);
		expect(text).toContain(`${BURST_COUNT} or more reports on one title`);
		expect(text).toContain(`within ${BURST_WINDOW_HOURS} hours`);
		expect(text).toContain(`under ${NEW_ACCOUNT_DAYS} days old`);
		expect(text).toContain(`more than ${NEW_ACCOUNT_REPORT_MAX} reports`);
	});

	it('has a nav entry for the section', () => {
		const { container } = render(Page);
		expect(container.querySelector('a[href="#community-reports"]')).toBeTruthy();
	});
});
