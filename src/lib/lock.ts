import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type LockInfo = { available: boolean; method: string; hint?: string };

/** O que o aparelho oferece para proteger o app. */
export async function lockInfo(): Promise<LockInfo> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return {
      available: false,
      method: 'Bloqueio',
      hint: 'Configure um código ou biometria no aparelho para usar esta proteção.',
    };
  }
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const biometric = level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
  if (Platform.OS === 'ios') {
    return {
      available: true,
      method: biometric && face ? 'Face ID' : biometric && finger ? 'Touch ID' : 'código do iPhone',
    };
  }
  return { available: true, method: biometric ? 'biometria' : 'bloqueio de tela' };
}

export async function authenticate(reason: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar código',
      disableDeviceFallback: false,
    });
    return res.success;
  } catch {
    return false;
  }
}
