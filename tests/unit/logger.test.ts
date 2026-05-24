import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('logger', () => {
  let consoleSpy: { log: any; warn: any; error: any };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
    // Clear module cache to re-evaluate NODE_ENV checks
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('development mode', () => {
    it('log.info calls console.log with prefix', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const { log } = await import('@/lib/logger');
      log.info('test message');
      expect(consoleSpy.log).toHaveBeenCalledOnce();
      const call = consoleSpy.log.mock.calls[0][0] as string;
      expect(call).toContain('test message');
    });

    it('log.warn calls console.warn', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const { log } = await import('@/lib/logger');
      log.warn('warning message');
      expect(consoleSpy.warn).toHaveBeenCalledOnce();
    });

    it('log.error calls console.error', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const { log } = await import('@/lib/logger');
      log.error('error message');
      expect(consoleSpy.error).toHaveBeenCalledOnce();
    });

    it('includes payload in output', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const { log } = await import('@/lib/logger');
      log.info('with payload', { shopId: 'shop_123' });
      const call = consoleSpy.log.mock.calls[0][0] as string;
      expect(call).toContain('shopId');
    });
  });

  describe('production mode', () => {
    it('log.info outputs JSON', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { log } = await import('@/lib/logger');
      log.info('prod message', { key: 'value' });
      expect(consoleSpy.log).toHaveBeenCalledOnce();
      const output = consoleSpy.log.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('info');
      expect(parsed.msg).toBe('prod message');
      expect(parsed.key).toBe('value');
      expect(parsed.ts).toBeDefined();
    });

    it('log.error outputs JSON to console.error', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { log } = await import('@/lib/logger');
      log.error('prod error', { code: 500 });
      expect(consoleSpy.error).toHaveBeenCalledOnce();
      const output = consoleSpy.error.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('error');
      expect(parsed.msg).toBe('prod error');
      expect(parsed.code).toBe(500);
    });

    it('log.warn outputs JSON to console.warn', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { log } = await import('@/lib/logger');
      log.warn('prod warning');
      expect(consoleSpy.warn).toHaveBeenCalledOnce();
      const output = consoleSpy.warn.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('warn');
    });
  });
});
