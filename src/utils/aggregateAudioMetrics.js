/**
 * Build session-level C5-style audio metrics from persisted per-answer analyses.
 */

export function aggregateAudioAnalyses(analyses) {
  if (!analyses?.length) return null;

  const wpms = [];
  let fillers = 0;
  let hesitations = 0;
  const clarities = [];
  const confidences = [];

  for (const row of analyses) {
    const raw = row.rawMetricsJson || {};
    let wpm = row.speechPaceWpm ?? raw.averageWPM;
    const duration = row.durationSeconds ?? raw.durationSeconds;
    const transcript = raw.transcriptWordEstimate;
    if ((wpm == null || wpm <= 0) && duration > 0 && transcript > 0) {
      wpm = (transcript / duration) * 60;
    }
    if (typeof wpm === 'number' && wpm > 0) wpms.push(wpm);
    let rowFillers = row.fillerWordsCount ?? raw.fillerWordCount ?? 0;
    if (rowFillers === 0 && raw.transcriptWordEstimate > 0) {
      const t = (raw.transcriptText || raw.fullTranscript || '').toLowerCase();
      if (t) {
        const fillerTokens = ['um', 'uh', 'like', 'basically', 'actually'];
        rowFillers = fillerTokens.reduce(
          (n, f) => n + (t.match(new RegExp(`\\b${f}\\b`, 'g')) || []).length,
          0
        );
      }
    }
    fillers += rowFillers;
    hesitations += row.hesitationCount ?? raw.hesitationCount ?? 0;
    const clarity = row.clarityScore ?? raw.clarityScore;
    if (typeof clarity === 'number') clarities.push(clarity);
    const confidence = raw.confidenceScore;
    if (typeof confidence === 'number') confidences.push(confidence);
  }

  const averageWPM =
    wpms.length > 0 ? wpms.reduce((a, b) => a + b, 0) / wpms.length : 0;
  const clarityScore =
    clarities.length > 0
      ? clarities.reduce((a, b) => a + b, 0) / clarities.length
      : 0;
  const confidenceScore =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : clarityScore;

  return {
    averageWPM: Math.round(averageWPM * 10) / 10,
    fillerWordCount: fillers,
    fillerWordPercentage: 0,
    hesitationCount: hesitations,
    longestPauseSecs: 0,
    averagePauseSecs: 0,
    confidenceScore: Math.round(confidenceScore * 10) / 10,
    clarityScore: Math.round(clarityScore * 10) / 10,
    answerCount: analyses.length,
  };
}
