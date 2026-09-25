import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'scamnomore.community.participant.v1';
let cachedParticipantId: string | undefined;

function createParticipantId(): string {
  // This token is only a random pseudonym. It contains no account, device,
  // contact, or location information and is never displayed to other users.
  const entropy = Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
  return `participant-${Date.now().toString(36)}-${entropy}`;
}

/** Return the same anonymous token on this device across Expo sessions. */
export async function getCommunityParticipantId(): Promise<string> {
  if (cachedParticipantId) return cachedParticipantId;

  try {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (stored) {
      cachedParticipantId = stored;
      return stored;
    }
  } catch {
    // SecureStore can be unavailable in a restricted preview. Keep the app
    // usable with a session-only fallback rather than blocking chat.
  }

  const created = createParticipantId();
  cachedParticipantId = created;
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, created);
  } catch {
    // The in-memory value still distinguishes messages for this app session.
  }
  return created;
}
