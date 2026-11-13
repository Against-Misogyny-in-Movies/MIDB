import { describe, expect, it } from 'vitest';
import type { ViewerReportView } from '#lib/media/types/community-reports.ts';
import {
	asksFlags,
	asksFraming,
	canSave,
	draftFromReport,
	emptyDraft,
	reportBody
} from '../reportDraft.ts';

describe('the report form gates', () => {
	it('waits for "I watched this" before Save', () => {
		const draft = emptyDraft();
		expect(canSave(draft)).toBe(false);
		draft.watched = true;
		expect(canSave(draft)).toBe(true);
	});

	it('asks the flags only when sexual violence is Present', () => {
		const draft = emptyDraft();
		for (const sexual of ['none', 'unsure'] as const) {
			draft.sexual = sexual;
			expect(asksFlags(draft)).toBe(false);
		}
		draft.sexual = 'present';
		expect(asksFlags(draft)).toBe(true);
	});

	it('asks the framing only when some violence is shown or implied', () => {
		const draft = emptyDraft();
		expect(asksFraming(draft)).toBe(false);
		draft.partner = 'none';
		draft.objectification = 'throughout';
		expect(asksFraming(draft)).toBe(false);
		draft.stalking = 'mentioned';
		expect(asksFraming(draft)).toBe(true);
		draft.stalking = 'unsure';
		draft.sexual = 'present';
		expect(asksFraming(draft)).toBe(true);
	});
});

describe('reportBody', () => {
	it('maps not sure to null and sends no flags unless Present', () => {
		const draft = { ...emptyDraft(), watched: true, partner: 'on_screen' as const };
		draft.flags.incest = 'yes';
		expect(reportBody(draft)).toEqual({
			watched: true,
			sexualPresent: null,
			partnerLevel: 'on_screen',
			physicalLevel: null,
			stalkingLevel: null,
			objectificationLevel: null,
			flags: {},
			framing: null
		});
	});

	it('sends every flag as yes, no or null when Present, and the framing when asked', () => {
		const draft = { ...emptyDraft(), watched: true, sexual: 'present' as const };
		draft.flags.incest = 'yes';
		draft.flags.attemptedRape = 'no';
		draft.framing = 'condemned';
		const body = reportBody(draft);
		expect(body.flags.incest).toBe(true);
		expect(body.flags.attemptedRape).toBe(false);
		expect(body.flags.rapeOnScreen).toBeNull();
		expect(Object.keys(body.flags)).toHaveLength(8);
		expect(body.framing).toBe('condemned');
	});

	it('drops a framing answer once its question is no longer asked', () => {
		const draft = { ...emptyDraft(), watched: true, framing: 'unclear' as const };
		expect(reportBody(draft).framing).toBeNull();
	});
});

describe('draftFromReport', () => {
	it('fills the form from a saved report', () => {
		const report = {
			sexualPresent: 'present',
			partnerLevel: null,
			physicalLevel: 'mentioned',
			stalkingLevel: 'none',
			objectificationLevel: 'some_scenes',
			incest: true,
			attemptedRape: false,
			framing: null
		} as unknown as ViewerReportView;
		const draft = draftFromReport(report);
		expect(draft).toMatchObject({
			watched: true,
			sexual: 'present',
			partner: 'unsure',
			physical: 'mentioned',
			stalking: 'none',
			objectification: 'some_scenes',
			framing: ''
		});
		expect(draft.flags.incest).toBe('yes');
		expect(draft.flags.attemptedRape).toBe('no');
		expect(draft.flags.rapeOnScreen).toBe('unsure');
	});
});
