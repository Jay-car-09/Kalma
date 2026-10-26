import AsyncStorage from '@react-native-async-storage/async-storage';

// Small settings only (theme, language, flags). Never store tracker data here.

const PREFIX = 'kalma.';

export async function readSetting(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export async function writeSetting(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, value);
  } catch {
    // A failed write only means the choice isn't remembered next launch.
  }
}
