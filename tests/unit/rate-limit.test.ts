import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, extractIP, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

describe('rate-limit', () => {
  describe('RATE_LIMITS constants', () => {
    it('has correct preset values', () => {
      expect(RATE_LIMITS.webhook).toBe(120);
      expect(RATE_LIMITS.api).toBe(30);
      expect(RATE_LIMITS.auth).toBe(10);
      expect(RATE_LIMITS.appointment).toBe(15);
    });
  });

  describe('extractIP', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      });
      expect(extractIP(request)).toBe('192.168.1.1');
    });

    it('extracts IP from x-real-ip header when no x-forwarded-for', () => {
      const request = new Request('http://localhost', {
        headers: { 'x-real-ip': '10.0.0.5' },
      });
      expect(extractIP(request)).toBe('10.0.0.5');
    });

    it('returns "anonymous" when no IP headers present', () => {
      const request = new Request('http://localhost');
      expect(extractIP(request)).toBe('anonymous');
    });

    it('prefers x-forwarded-for over x-real-ip', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '5.6.7.8',
        },
      });
      expect(extractIP(request)).toBe('1.2.3.4');
    });
  });

  describe('rateLimitResponse', () => {
    it('returns 429 status', () => {
      const response = rateLimitResponse();
      expect(response.status).toBe(429);
    });

    it('includes Retry-After header', () => {
      const response = rateLimitResponse();
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('includes JSON content type', () => {
      const response = rateLimitResponse();
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('returns error message in body', async () => {
      const response = rateLimitResponse();
      const body = await response.json();
      expect(body.error).toContain('Too many requests');
    });
  });

  describe('checkRateLimit (in-memory fallback)', () => {
    it('allows requests within limit', async () => {
      const uniqueKey = `test-allow-${Date.now()}`;
      const result = await checkRateLimit(uniqueKey, 'auth'); // limit: 10
      expect(result.success).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('blocks requests exceeding limit', async () => {
      const uniqueKey = `test-block-${Date.now()}`;
      // auth preset = 10 requests per minute
      for (let i = 0; i < 10; i++) {
        await checkRateLimit(uniqueKey, 'auth');
      }
      const result = await checkRateLimit(uniqueKey, 'auth');
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('defaults to api preset when no preset specified', async () => {
      const uniqueKey = `test-default-${Date.now()}`;
      const result = await checkRateLimit(uniqueKey);
      expect(result.success).toBe(true);
    });
  });
});
