/**
 * Structured JSON logger for Vercel serverless
 *
 * Outputs JSON lines that Vercel's log drain can parse and filter.
 * Usage: log.info('msg', { shopId, from }) / log.error('msg', { err })
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, payload?: LogPayload) {
  const entry = {
    level,
    msg: message,
    ts: new Date().toISOString(),
    ...payload,
  };

  // In production: JSON for Vercel log drain
  // In dev: readable console output
  if (process.env.NODE_ENV === 'production') {
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  } else {
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
    const extra = payload ? ` ${JSON.stringify(payload)}` : '';
    if (level === 'error') console.error(`${prefix} ${message}${extra}`);
    else if (level === 'warn') console.warn(`${prefix} ${message}${extra}`);
    else console.log(`${prefix} ${message}${extra}`);
  }
}

export const log = {
  info: (msg: string, payload?: LogPayload) => emit('info', msg, payload),
  warn: (msg: string, payload?: LogPayload) => emit('warn', msg, payload),
  error: (msg: string, payload?: LogPayload) => emit('error', msg, payload),
};
