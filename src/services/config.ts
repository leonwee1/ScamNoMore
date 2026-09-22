import Constants from 'expo-constants';

/**
 * Runtime configuration for AWS integrations.
 *
 * Expo Go cannot bundle AWS credentials securely and many AWS SDK transports
 * are not available on-device. The recommended production topology is:
 *
 *   App (Expo) --> API Gateway + Lambda --> Rekognition / Transcribe / Bedrock / DynamoDB
 *
 * so that no long-lived credentials ever live on the device. The service layer
 * below therefore talks to a backend base URL when configured, and otherwise
 * falls back to deterministic on-device mocks (useMockServices = true) so the
 * app is fully demoable in Expo Go with zero cloud setup.
 */
type Extra = {
  awsRegion?: string;
  dynamoTable?: string;
  useMockServices?: boolean;
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  awsRegion: extra.awsRegion ?? 'ap-southeast-1',
  dynamoTable: extra.dynamoTable ?? 'ScamNoMoreScams',
  /** When true (default in app.json), all services return local mock results. */
  useMockServices: extra.useMockServices ?? true,
  /** Base URL of the API Gateway front door (used when not mocking). */
  apiBaseUrl: extra.apiBaseUrl ?? '',
};
