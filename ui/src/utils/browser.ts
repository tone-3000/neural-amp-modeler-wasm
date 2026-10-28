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

interface PolicyApi {
  allowsFeature(feature: string): boolean;
  features?(): string[];
}

type PolicyDocument = Document & {
  permissionsPolicy?: PolicyApi;
  featurePolicy?: PolicyApi;
};

/**
 * Whether the page embedding us grants this frame a permissions-policy
 * feature (`<iframe allow="…">`). `null` when the browser doesn't expose the
 * policy (Firefox, Safari) or doesn't know the feature name — `allowsFeature`
 * answers `false` for names it has never heard of, which must not read as a
 * denial. A real denial surfaces as a `NotAllowedError` from the API itself.
 */
function featureAllowedByPolicy(feature: string): boolean | null {
  if (typeof document === 'undefined') return null;
  const doc = document as PolicyDocument;
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  if (!policy?.allowsFeature) return null;
  try {
    if (policy.features && !policy.features().includes(feature)) return null;
    return policy.allowsFeature(feature);
  } catch {
    return null;
  }
}

/** `<iframe allow="microphone">`: needed for live input. */
export function microphoneAllowedByPolicy(): boolean | null {
  return featureAllowedByPolicy('microphone');
}

/**
 * `<iframe allow="speaker-selection">`: needed to route output to a chosen
 * device (`setSinkId`). Cross-origin frames don't get it by default, so an
 * embed without it keeps the system default output and hides the picker.
 */
export function speakerSelectionAllowedByPolicy(): boolean | null {
  return featureAllowedByPolicy('speaker-selection');
}

export type BrowserName = 'chrome' | 'safari' | 'firefox' | 'edge' | 'other';

export function getBrowserName(): BrowserName {
  if (isEdge) return 'edge';
  if (isFirefox) return 'firefox';
  if (isSafari) return 'safari';
  if (isChrome) return 'chrome';
  return 'other';
}
