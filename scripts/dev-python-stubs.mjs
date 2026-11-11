/**
 * Dev-only stubs when FastAPI services cannot run (no pip/docker).
 * Implements minimal routes for spine + UI smoke tests.
 */
import http from 'http';

const sessions = new Map();

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString() || '{}'));
  });
}

const agent = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8000');
  if (url.pathname === '/health') return json(res, 200, { status: 'healthy', service: 'agent-stub' });
  if (req.method === 'POST' && url.pathname === '/api/v1/interview/start') {
    const body = JSON.parse(await readBody(req));
    const sessionId = body.session_id || 'stub-session';
    const qid = 'q-stub-1';
    sessions.set(sessionId, { questions: [qid], idx: 0 });
    return json(res, 201, {
      session_id: sessionId,
      candidate_name: body.candidate_name,
      round_type: 'technical',
      questions: [{ question_id: qid, text: 'Explain how you would design a rate limiter for a public API.', source_agent: 'stub', hardened: true }],
      debate_log: [],
      message: 'stub session',
    });
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/interview/answer') {
    const body = JSON.parse(await readBody(req));
    return json(res, 200, {
      session_id: body.session_id,
      evaluation: { question_id: body.question_id, question_text: 'stub', candidate_answer: body.candidate_answer, score: 8, feedback: 'Strong structured answer (stub agent).', follow_up_question: null },
      next_question: null,
      session_complete: true,
    });
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/v1/interview/summary/')) {
    const sessionId = url.pathname.split('/').pop();
    return json(res, 200, {
      session_id: sessionId,
      candidate_name: 'Demo',
      overall_score: 8,
      per_question_results: [],
      hr_assessment: 'Stub HR assessment.',
      strengths: ['Clear communication'],
      weaknesses: ['Add more edge cases'],
      hiring_recommendation: 'Hire',
    });
  }
  if (req.method === 'POST' && url.pathname === '/api/v1/canvas/analyse') {
    const body = JSON.parse(await readBody(req));
    const nodeId = body.canvas_json?.nodes?.[0]?.id || 'database-1';
    return json(res, 200, {
      session_id: body.session_id,
      flaws: [{ component_id: nodeId, flaw_description: 'Single node SPOF (stub)', severity: 'medium' }],
      suggestions: ['Add redundancy'],
      overall_assessment: 'Stub canvas review.',
    });
  }
  json(res, 404, { detail: 'not found' });
});

const ml = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8001');
  if (url.pathname === '/health') return json(res, 200, { status: 'healthy', service: 'ml-stub' });
  const bodyText = req.method !== 'GET' ? await readBody(req) : '{}';
  let body = {};
  try { body = JSON.parse(bodyText || '{}'); } catch { /* multipart etc */ }

  if (url.pathname === '/api/v1/audio/chunk') {
    return json(res, 200, {
      session_id: body.session_id,
      sequence: body.sequence,
      metrics: { currentWPM: 128, fillerWords: 1, hesitationSpikes: 0, silenceDurationMs: 0, volumeLevel: 0.6, isSpeaking: true },
      cumulative_hesitation_spikes: 0,
    });
  }
  if (url.pathname === '/api/v1/transcript/segment') {
    return json(res, 200, { session_id: body.session_id, full_transcript: body.text, word_count: 12, metrics: { currentWPM: 130, fillerWords: 0, hesitationSpikes: 0, silenceDurationMs: 0, volumeLevel: 0.5, isSpeaking: false } });
  }
  if (url.pathname.startsWith('/api/v1/sessions/') && url.pathname.endsWith('/envelope')) {
    const sessionId = url.pathname.split('/')[4];
    return json(res, 200, { session_id: sessionId, audio_transcript: '', real_time_metrics: { currentWPM: 120, fillerWords: 0, hesitationSpikes: 0, silenceDurationMs: 0, volumeLevel: 0.4, isSpeaking: false }, audio_metrics: null });
  }
  if (url.pathname === '/api/v1/audio/finalize') {
    return json(res, 200, {
      session_id: body.session_id,
      audio_transcript: '',
      audio_metrics: { averageWPM: 125, fillerWordCount: 1, fillerWordPercentage: 2, hesitationCount: 0, longestPauseSecs: 0.5, averagePauseSecs: 0.2, confidenceScore: 82, clarityScore: 85 },
    });
  }
  json(res, 404, { detail: 'not found' });
});

agent.listen(8000, () => console.log('[stub] agent :8000'));
ml.listen(8001, () => console.log('[stub] ml :8001'));
