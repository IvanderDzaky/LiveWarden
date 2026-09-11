import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { aiSummaries, events, liveSessions, streams } from '../db/schema.js';
import { getSessionReport } from './service.js';

export const generateSessionSummary = async (userId: string, sessionId: string) => {
  return generateSessionSummaryInternal(await getSessionReport(userId, sessionId), sessionId);
};

export const generateSessionSummaryForDelivery = async (sessionId: string) => {
  if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const report = await getSessionReportInternal(sessionId);
  return generateSessionSummaryInternal(report, sessionId);
};

export const markSessionSummaryFailed = async (sessionId: string, reason: string) => {
  await db.update(aiSummaries).set({ status: 'FAILED', failureReason: reason.slice(0, 500), updatedAt: new Date() }).where(eq(aiSummaries.liveSessionId, sessionId));
};

export const geminiSummarySchema = z.object({
  sessionSummary: z.string().min(1).max(10_000),
  keyMoments: z.array(z.object({ eventId: z.string().uuid(), description: z.string().min(1).max(1_000) })).max(50),
  audienceChanges: z.string().max(5_000),
  problems: z.array(z.string().min(1).max(1_000)).max(50),
  insights: z.array(z.string().min(1).max(1_000)).max(50),
  recommendations: z.array(z.string().min(1).max(1_000)).max(50),
  limitations: z.array(z.string().min(1).max(1_000)).max(50)
}).strict();

export const validateGeminiSummary = (value: unknown, sessionEventIds: Iterable<string>) => {
  const summary = geminiSummarySchema.parse(value);
  const validIds = new Set(sessionEventIds);
  if (summary.keyMoments.some((moment) => !validIds.has(moment.eventId))) throw new Error('Gemini key moment references event outside session');
  return summary;
};

const generateSessionSummaryInternal = async (report: Awaited<ReturnType<typeof getSessionReport>>, sessionId: string) => {
  if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const apiKey = config.GEMINI_API_KEY;
  const prompt = `Return JSON only with keys sessionSummary, keyMoments, audienceChanges, problems, insights, recommendations, limitations. Analyze this livestream session. Never invent event IDs. Data: ${JSON.stringify({ aggregates: report.aggregates, keyEvents: report.keyEvents, alerts: report.alerts, commentSamples: report.commentSamples, limitations: report.limitations })}`;
  const model = config.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }) });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty output');
  const result = geminiSummarySchema.parse(JSON.parse(text));
  const session = (await db.select({ id: liveSessions.id }).from(liveSessions).where(eq(liveSessions.id, sessionId)).limit(1))[0];
  if (!session) throw new Error('session not found');
  const eventIds = result.keyMoments.map((moment) => moment.eventId);
  if (eventIds.length) {
    const validEvents = await db.select({ id: events.id }).from(events).where(and(eq(events.liveSessionId, sessionId), inArray(events.id, eventIds)));
    validateGeminiSummary(result, validEvents.map((event) => event.id));
  }
  await db.insert(aiSummaries).values({ liveSessionId: sessionId, status: 'COMPLETED', sessionSummary: typeof result.sessionSummary === 'string' ? result.sessionSummary : null, keyMoments: result.keyMoments ?? [], audienceChanges: typeof result.audienceChanges === 'string' ? result.audienceChanges : null, problems: result.problems ?? [], insights: result.insights ?? [], recommendations: result.recommendations ?? [], limitations: result.limitations ?? report.limitations, model, requestedAt: new Date(), generatedAt: new Date() }).onConflictDoUpdate({ target: aiSummaries.liveSessionId, set: { status: 'COMPLETED', sessionSummary: typeof result.sessionSummary === 'string' ? result.sessionSummary : null, keyMoments: result.keyMoments ?? [], audienceChanges: typeof result.audienceChanges === 'string' ? result.audienceChanges : null, problems: result.problems ?? [], insights: result.insights ?? [], recommendations: result.recommendations ?? [], limitations: result.limitations ?? report.limitations, model, generatedAt: new Date(), failureReason: null, updatedAt: new Date() } });
  return result;
};

const getSessionReportInternal = async (sessionId: string) => {
  const session = (await db.select({ streamId: liveSessions.streamId }).from(liveSessions).where(eq(liveSessions.id, sessionId)).limit(1))[0];
  if (!session) throw new Error('session not found');
  return getSessionReport('', sessionId).catch(async () => {
    const { getSessionReportForInternal } = await import('./service.js');
    return getSessionReportForInternal(sessionId);
  });
};
