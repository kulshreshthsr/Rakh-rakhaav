const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

let transport;
if (isDev) {
  try {
    require.resolve('pino-pretty');
    transport = pino.transport({ target: 'pino-pretty', options: { colorize: true, ignore: 'pid,hostname' } });
  } catch {
    // pino-pretty not installed — use plain pino
  }
}

const logger = pino(
  { level: isDev ? 'debug' : 'info' },
  transport
);

module.exports = logger;
