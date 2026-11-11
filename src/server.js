import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import * as agentClient from './services/agentClient.js';

async function startServer() {
  await connectDatabase();

  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  const topologyDebounce = new Map();

  io.on('connection', (socket) => {
    const sessionId = socket.handshake.query?.sessionId || 'canvas-demo';
    console.log(`[socket] connected ${socket.id} session=${sessionId}`);

    const analyze = async (topology) => {
      const canvasJson = {
        nodes: topology?.nodes || [],
        edges: topology?.edges || [],
      };
      try {
        const result = await agentClient.analyseCanvas(sessionId, canvasJson);
        for (const flaw of result.flaws || []) {
          const nodeId = flaw.component_id || flaw.node_id || flaw.componentId;
          if (nodeId) {
            io.emit('flaw_detected', {
              node_id: nodeId,
              message: flaw.flaw_description || flaw.message,
            });
          }
        }
      } catch (err) {
        console.warn('[socket] canvas analyse failed', err.message);
      }
    };

    const scheduleAnalyze = (topology) => {
      clearTimeout(topologyDebounce.get(socket.id));
      topologyDebounce.set(
        socket.id,
        setTimeout(() => analyze(topology), 800)
      );
    };

    socket.on('topology_update', scheduleAnalyze);
    socket.on('topology', scheduleAnalyze);
    socket.on('graph_update', scheduleAnalyze);

    socket.on('disconnect', () => {
      clearTimeout(topologyDebounce.get(socket.id));
      topologyDebounce.delete(socket.id);
    });
  });

  server.listen(env.PORT, () => {
    console.log(`🚀 Server + Socket.IO on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });
}

startServer();
