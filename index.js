/**
 * App entry point.
 *
 * This replaces the default `node_modules/expo/AppEntry.js` so that web builds
 * can pull in `@expo/metro-runtime`, which provides Fast Refresh and the error
 * overlay in the browser. The stock AppEntry does not import it, so without
 * this file `npx expo start --web` runs with a degraded dev experience.
 *
 * On native the metro-runtime import is inert, so the same entry serves
 * Android, iOS and web.
 */
import '@expo/metro-runtime';

import { registerRootComponent } from 'expo';

import App from './App';

// Sets up the root component for both Expo Go and standalone builds.
registerRootComponent(App);
