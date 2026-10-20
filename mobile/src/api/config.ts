import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 5080;

/**
 * In development the API is expected on the machine that runs Metro, so the same build works on
 * simulators, emulators and physical devices on the same network. EXPO_PUBLIC_API_URL overrides it.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost) {
    return `http://${devHost}:${API_PORT}`;
  }

  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
