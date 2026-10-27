const ua =
  typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';

export const isFirefox = ua.includes('firefox');
export const isSafari =
  ua.includes('safari') &&
  !ua.includes('chrome') &&
  !ua.includes('firefox') &&
  !ua.includes('edg');
export const isEdge = ua.includes('edg');
export const isChrome =
  (ua.includes('chrome') || ua.includes('crios')) && !ua.includes('edg');
export const needsMediaStreamWorkaround = isFirefox || isSafari;

/** Running inside an iframe (an embed). */
export const isFramed =
  typeof window !== 'undefined' && window.self !== window.top;

type PolicyDocument = Document & {
  permissionsPolicy?: { allowsFeature(feature: string): boolean };
  featurePolicy?: { allowsFeature(feature: string): boolean };
};

/**
 * Whether the page embedding us grants this frame the microphone
 * (`<iframe allow="microphone">`). `null` when the browser doesn't expose the
 * policy (Firefox, Safari) — there, a denied policy surfaces as a plain
 * `NotAllowedError` from `getUserMedia`.
 */
export function microphoneAllowedByPolicy(): boolean | null {
  if (typeof document === 'undefined') return null;
  const doc = document as PolicyDocument;
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  if (!policy?.allowsFeature) return null;
  try {
    return policy.allowsFeature('microphone');
  } catch {
    return null;
  }
}

export type BrowserName = 'chrome' | 'safari' | 'firefox' | 'edge' | 'other';

export function getBrowserName(): BrowserName {
  if (isEdge) return 'edge';
  if (isFirefox) return 'firefox';
  if (isSafari) return 'safari';
  if (isChrome) return 'chrome';
  return 'other';
}
