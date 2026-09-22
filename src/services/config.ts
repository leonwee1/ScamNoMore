import Constants from 'expo-constants';

/**
 * Runtime configuration for the AWS backend.
 *
 * Expo Go cannot hold AWS credentials securely, so the app never calls AWS
 * directly. It talks to an HTTPS backend that performs the AWS work:
 *
 *   App (Expo) --> API Gateway + Lambda --> Rekognition / Rekognition Video
 *                                          Transcribe / Bedrock / DynamoDB
 *
 * Set `apiBaseUrl` in app.json (expo.extra) to either:
 *   - your deployed API Gateway stage URL, or
 *   - your machine's LAN URL while running backend/src/local-server.ts
 *     (e.g. http://172.20.10.11:3000)
 *
 * There is no mock mode: if this is unset, analysis calls fail with a clear
 * error instead of returning invented results.
 */
type Extra = {
  awsRegion?: string;
  dynamoTable?: string;
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  awsRegion: extra.awsRegion ?? 'ap-southeast-1',
  dynamoTable: extra.dynamoTable ?? 'ScamNoMoreScams',
  apiBaseUrl: extra.apiBaseUrl ?? '',
};
