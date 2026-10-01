/**
 * server.js - Servidor HTTP + WebSocket Local para el Aula de Arte
 * Permite que todos los celulares de los alumnos y la pantalla del proyector
 * se sincronicen en tiempo real con 0ms de latencia, incluso sin internet (offline).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 8080;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

// Servidor de archivos estáticos
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0].split('#')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, reqPath);

  // Seguridad: evitar directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Acceso denegado');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (reqPath.endsWith('.ico')) {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Servidor WebSocket en el mismo puerto (/ws)
const wss = new WebSocketServer({ server, path: '/ws' });

let clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Dispositivo conectado. Total conectados: ${clients.size}`);

  ws.on('message', (message) => {
    // Reenviar el mensaje a todos los demás dispositivos conectados (alumnos y proyector)
    for (const client of clients) {
      if (client !== ws && client.readyState === 1) { // 1 = OPEN
        client.send(message);
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Dispositivo desconectado. Total conectados: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.warn('[WS] Error en cliente:', err.message);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================================`);
  console.log(`  SERVIDOR CUBISMO SINTÉTICO ACTIVO EN PUERTO ${PORT}`);
  console.log(`  - Local:     http://localhost:${PORT}`);
  console.log(`  - Proyector: http://localhost:${PORT}#admin`);
  console.log(`  - WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`========================================================\n`);
});
