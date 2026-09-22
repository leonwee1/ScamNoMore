import Constants from 'expo-constants';

/**
 * Runtime configuration.
 *
 * The app never holds the OpenAI key — anything bundled into an Expo app can be
 * extracted. It talks to the small backend in `backend/`, which holds the key
 * server-side and calls OpenAI:
 *
 *   App (Expo) --> backend --> OpenAI (gpt-4o vision, Whisper, chat)
 *
 * Set `apiBaseUrl` in app.json (expo.extra) to your backend URL, e.g.
 * http://172.20.10.11:3000 while developing (your machine's LAN IP, not
 * localhost — the phone must be able to reach it).
 *
 * There is no mock mode: if this is unset, analysis fails with a clear error
 * instead of returning invented results.
 */
type Extra = {
  apiBaseUrl?: string;
  appSecret?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  apiBaseUrl: extra.apiBaseUrl ?? '',
  /**
   * Shared secret sent as `x-app-secret`. It must match APP_SHARED_SECRET on the
   * backend.
   *
   * NOTE: this is bundled into the app, so it is not cryptographically secret —
   * someone who extracts the bundle can read it. Its purpose is to stop casual
   * abuse of your public backend URL, not to provide real user authentication.
   */
  appSecret: extra.appSecret ?? '',
};
