// The phone's own Face ID / fingerprint, with the phone passcode as fallback. No Kalma PIN.
// The library loads only when first used, and every call is caught. An error in the unlock
// prompt keeps the app locked (Unlock tries again); only a phone with no screen lock turns the
// lock off, so nobody is trapped.

type LocalAuth = typeof import('expo-local-authentication');

let authenticating = false;

/** True while the system unlock prompt is up (it can briefly send the app to the background). */
export function isAuthenticating(): boolean {
  return authenticating;
}

function localAuth(): LocalAuth | null {
  try {
    return require('expo-local-authentication') as LocalAuth;
  } catch (error) {
    console.warn('[lock] local authentication unavailable', error);
    return null;
  }
}

/** Does the phone have Face ID / fingerprint / passcode set up? */
export async function hasScreenLock(): Promise<boolean> {
  const auth = localAuth();
  if (!auth) return false;
  try {
    return (await auth.getEnrolledLevelAsync()) !== auth.SecurityLevel.NONE;
  } catch (error) {
    console.warn('[lock] could not check the screen lock', error);
    return false;
  }
}

/** Shows the phone's unlock prompt. Resolves true only on success; cancel or failure → false. */
export async function authenticate(promptMessage: string, cancelLabel: string): Promise<boolean> {
  const auth = localAuth();
  if (!auth) return false;
  authenticating = true;
  try {
    const result = await auth.authenticateAsync({ promptMessage, cancelLabel, disableDeviceFallback: false });
    return result.success;
  } catch (error) {
    console.warn('[lock] unlock prompt failed', error);
    return false;
  } finally {
    authenticating = false;
  }
}
