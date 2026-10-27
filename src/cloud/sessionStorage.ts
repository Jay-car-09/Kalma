import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import { getRandomValues } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Where Supabase keeps the login session (accounts-security §1.3), following Supabase's
 * documented secure-storage pattern for Expo. The session is too big for the keychain, so:
 * a fresh random AES-256 key goes in the phone's secure keychain (expo-secure-store), and the
 * session, encrypted with that key, goes in AsyncStorage. AsyncStorage never holds it in plain text.
 * (The guide's react-native-get-random-values is replaced by expo-crypto, which is already approved.)
 */
export class EncryptedSessionStorage {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    return encrypted ? this.decrypt(key, encrypted) : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, await this.encrypt(key, value));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}
