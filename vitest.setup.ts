import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.WHATSAPP_VERIFY_TOKEN = 'test_token';
process.env.CRON_SECRET = 'test_secret';
process.env.META_APP_ID = process.env.META_APP_ID || 'TEST_APP_ID';
process.env.FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'TEST_APP_SECRET';
process.env.WHATSAPP_SYSTEM_USER_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || 'TEST_SYS_TOKEN';
