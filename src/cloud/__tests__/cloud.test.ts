import { describe, expect, it, jest } from '@jest/globals';

import { describeReply } from '../check';

// In-memory stand-ins for the phone's AsyncStorage and secure mockKeychain.
const mockPlain = new Map<string, string>();
const mockKeychain = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (k: string) => mockPlain.get(k) ?? null,
  setItem: async (k: string, v: string) => void mockPlain.set(k, v),
  removeItem: async (k: string) => void mockPlain.delete(k),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockKeychain.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockKeychain.set(k, v),
  deleteItemAsync: async (k: string) => void mockKeychain.delete(k),
}));
jest.mock('expo-crypto', () => ({ getRandomValues: (a: Uint8Array) => require('node:crypto').getRandomValues(a) }));

const { EncryptedSessionStorage } = require('../sessionStorage') as typeof import('../sessionStorage');

describe('login session storage', () => {
  const session = JSON.stringify({ access_token: 'secret-token-123', user: { email: 'juan@example.com' } });

  it('round-trips, but AsyncStorage only ever holds ciphertext', async () => {
    const storage = new EncryptedSessionStorage();
    await storage.setItem('sb-auth-token', session);
    expect(mockPlain.get('sb-auth-token')).not.toContain('secret-token');
    expect(mockPlain.get('sb-auth-token')).not.toContain('juan');
    expect(mockKeychain.get('sb-auth-token')).toMatch(/^[0-9a-f]{64}$/); // a 256-bit key
    expect(await storage.getItem('sb-auth-token')).toBe(session);
  });

  it('uses a new key every save', async () => {
    const storage = new EncryptedSessionStorage();
    await storage.setItem('k', session);
    const first = mockKeychain.get('k');
    await storage.setItem('k', session);
    expect(mockKeychain.get('k')).not.toBe(first);
  });

  it('sign out removes both halves; a missing key reads as signed out', async () => {
    const storage = new EncryptedSessionStorage();
    await storage.setItem('k', session);
    await storage.removeItem('k');
    expect(mockPlain.has('k') || mockKeychain.has('k')).toBe(false);
    mockPlain.set('k', 'abcd');
    expect(await storage.getItem('k')).toBeNull();
  });
});

describe('cloud connection check', () => {
  it('reads the reply in mockPlain terms', () => {
    expect(describeReply(null, 200)).toBe('connected');
    expect(describeReply({ code: '42501' }, 401)).toBe('connected'); // signed out and refused = locked
    expect(describeReply({ code: 'PGRST205' }, 404)).toBe('noTables');
    expect(describeReply({ code: '' }, 401)).toBe('badKey');
    expect(describeReply({ code: '' }, 0)).toBe('offline');
    expect(describeReply({ code: 'XX000' }, 500)).toBe('unknown');
  });
});
