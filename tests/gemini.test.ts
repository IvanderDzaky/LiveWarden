import assert from 'node:assert/strict';
import test from 'node:test';
import { geminiSummarySchema, validateGeminiSummary } from '../src/sessions/ai.js';

const summary = (eventId = '00000000-0000-0000-0000-000000000001') => ({
  sessionSummary: 'Session summary',
  keyMoments: [{ eventId, description: 'Viewer drop' }],
  audienceChanges: 'Audience increased after gift activity.',
  problems: [],
  insights: ['Chat activity was concentrated near the middle of the session.'],
  recommendations: ['Review the middle segment.'],
  limitations: ['Comment samples are bounded.']
});

test('Gemini output schema accepts bounded report contract', () => {
  assert.equal(geminiSummarySchema.parse(summary()).sessionSummary, 'Session summary');
});

test('Gemini output rejects unknown fields and invalid key moment references', () => {
  assert.throws(() => geminiSummarySchema.parse({ ...summary(), unexpected: true }));
  assert.throws(() => validateGeminiSummary(summary(), []), /outside session/);
});

test('Gemini output accepts key moments belonging to session events', () => {
  assert.equal(validateGeminiSummary(summary(), ['00000000-0000-0000-0000-000000000001']).keyMoments.length, 1);
});
