import { WebSocketServer } from 'ws';
import { verifyToken } from '../utils/security.js';
import * as mlClient from '../services/mlClient.js';

function parseSessionFromUrl(request) {
  const host = request.headers.host || 'localhost';
  const url = new URL(request.url, `http://${host}`);
  return {
    pathname: url.pathname,
    sessionId: url.searchParams.get('sessionId'),
    token: url.searchParams.get('token'),
  };
}

function sendJson(ws, type, payload, sessionId) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(
    JSON.stringify({
      type,
      payload,
      timestamp: Date.now(),
      sessionId,
    })
  );
}

export function attachInterviewWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname, sessionId, token } = parseSessionFromUrl(request);

    if (pathname !== '/ws') {
      return;
    }

    if (!sessionId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    if (token) {
      try {
        verifyToken(token);
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.interviewSessionId = sessionId;
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    const sessionId = ws.interviewSessionId;
    let sequence = 0;
    let streaming = false;
    let sampleRate = 16000;

    console.log(`[ws] interview connected session=${sessionId}`);

    ws.on('message', async (data) => {
      const binary = Buffer.isBuffer(data) || data instanceof ArrayBuffer;

      if (binary) {
        if (!streaming) return;
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (buf.length === 0) return;

        try {
          const result = await mlClient.processAudioChunk({
            session_id: sessionId,
            sequence: sequence++,
            sample_rate: sampleRate,
            encoding: 'float32',
            pcm_base64: buf.toString('base64'),
          });
          if (result?.metrics) {
            sendJson(ws, 'metrics:update', result.metrics, sessionId);
          }
        } catch (err) {
          console.warn('[ws] ML chunk failed:', err.message);
        }
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      switch (msg.type) {
        case 'heartbeat':
          sendJson(ws, 'heartbeat_ack', { timestamp: Date.now() }, sessionId);
          break;
        case 'audio:start':
          streaming = true;
          sequence = 0;
          sampleRate = msg.payload?.sampleRate || 16000;
          try {
            await mlClient.resetAudioCounters(sessionId);
          } catch (err) {
            console.warn('[ws] ML reset-counters failed:', err.message);
          }
          break;
        case 'audio:stop':
          streaming = false;
          break;
        case 'transcript:partial':
        case 'transcript:final': {
          const text = msg.payload?.text;
          if (!text?.trim()) break;
          try {
            await mlClient.appendTranscript(
              sessionId,
              text,
              msg.type === 'transcript:final'
            );
            const envelope = await mlClient.getEnvelope(sessionId);
            if (envelope?.real_time_metrics) {
              sendJson(ws, 'metrics:update', envelope.real_time_metrics, sessionId);
            }
            if (msg.type === 'transcript:final') {
              sendJson(
                ws,
                'transcript:final',
                {
                  text: text.trim(),
                  isFinal: true,
                  confidence: 1,
                  speaker: 'candidate',
                },
                sessionId
              );
            }
          } catch (err) {
            console.warn('[ws] transcript segment failed:', err.message);
          }
          break;
        }
        default:
          break;
      }
    });

    ws.on('close', () => {
      streaming = false;
    });
  });

  return wss;
}
