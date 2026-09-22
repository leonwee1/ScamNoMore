import { config } from './config';
import { analyzeText, AnalysisResult, riskFromProbability } from './analysis';

/**
 * Thin service facade over the AWS integrations required by the brief:
 *  - Rekognition (image)         -> analyzeImage
 *  - Rekognition Video           -> analyzeVideo
 *  - Transcribe + Bedrock (voice)-> transcribeAudio + analyzeText
 *  - Bedrock LLM (chatbot)       -> chat
 *  - DynamoDB (reports/data)     -> see dynamo.ts
 *
 * Each method calls the backend API (API Gateway + Lambda) when apiBaseUrl is
 * set and useMockServices is false; otherwise it returns a deterministic
 * on-device mock so the app runs in Expo Go without any cloud setup.
 */

async function callApi<T>(pathName: string, body: unknown): Promise<T> {
  const res = await fetch(`${config.apiBaseUrl}${pathName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${pathName} failed: ${res.status}`);
  return (await res.json()) as T;
}

const shouldMock = () => config.useMockServices || !config.apiBaseUrl;

// --- Sample OCR/transcription text used by mocks (varied but deterministic) ---
const MOCK_OCR_SAMPLES = [
  'URGENT: Your DBS account has unusual activity. Verify your account within 12 hours or it will be suspended. Click the link to confirm your password and OTP.',
  'Congratulations! You have won the Singtel lucky draw jackpot. Pay a small processing fee via PayNow to claim your prize.',
  'Hi, I am from the investment group. Guaranteed returns of 30% weekly with USDT on MetaTrader. Join via Telegram for referral bonus.',
  'Selling brand new iPhone at 60% discount on Carousell. PayNow first to reserve, no meetup, limited stock.',
];

function hashPick<T>(seed: string, arr: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

export const aws = {
  /** Rekognition DetectText + moderation on an image; returns scam analysis. */
  async analyzeImage(imageUri: string): Promise<AnalysisResult> {
    if (shouldMock()) {
      const ocr = hashPick(imageUri, MOCK_OCR_SAMPLES);
      const result = analyzeText(ocr);
      result.reasons.unshift('Rekognition detected text in the image (OCR).');
      return result;
    }
    return callApi<AnalysisResult>('/analyze/image', { imageUri });
  },

  /** Rekognition Video label/text detection across frames. */
  async analyzeVideo(videoUri: string): Promise<AnalysisResult> {
    if (shouldMock()) {
      const ocr = hashPick(videoUri, MOCK_OCR_SAMPLES);
      const result = analyzeText(ocr);
      result.reasons.unshift(
        'Rekognition Video sampled frames and detected on-screen text/labels.'
      );
      return result;
    }
    return callApi<AnalysisResult>('/analyze/video', { videoUri });
  },

  /** AWS Transcribe: audio -> text. */
  async transcribeAudio(audioUri: string): Promise<string> {
    if (shouldMock()) {
      return hashPick(audioUri, MOCK_OCR_SAMPLES);
    }
    const { text } = await callApi<{ text: string }>('/transcribe', { audioUri });
    return text;
  },

  /** Bedrock LLM analysis of transcribed/edited text. */
  async analyzeTranscript(text: string): Promise<AnalysisResult> {
    if (shouldMock()) {
      const result = analyzeText(text);
      result.reasons.unshift('Bedrock LLM assessed the transcribed narrative.');
      return result;
    }
    return callApi<AnalysisResult>('/analyze/text', { text });
  },

  /** Bedrock chatbot for scam questions and awareness tips. */
  async chat(message: string, history: ChatTurn[]): Promise<string> {
    if (shouldMock()) {
      return mockChat(message);
    }
    const { reply } = await callApi<{ reply: string }>('/chat', { message, history });
    return reply;
  },
};

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Rule-based stand-in for the Bedrock chatbot (awareness tips + Q&A). */
export function mockChat(message: string): string {
  const m = message.toLowerCase();
  if (/otp|password|one-time/.test(m)) {
    return 'Never share your OTP or password with anyone — not even people claiming to be from your bank or the police. Banks and government agencies will never ask for it.';
  }
  if (/invest|crypto|bitcoin|returns/.test(m)) {
    return 'Investment scams promise "guaranteed" or unusually high returns. No legitimate investment guarantees profit. Verify the platform with MAS Financial Institutions Directory before transferring any money.';
  }
  if (/job|part.?time|commission|task/.test(m)) {
    return 'Job scams ask you to pay upfront "training" or "commission task" fees, or to complete tasks for payouts. A real employer never asks you to pay them. Stop if money is requested.';
  }
  if (/police|iras|ica|court|arrest|government/.test(m)) {
    return 'Government agencies will not call to demand transfers or threaten arrest over the phone. Hang up and verify by calling the agency\'s official number, or call the ScamShield helpline at 1799.';
  }
  if (/love|romance|dating|overseas/.test(m)) {
    return 'Romance scammers build trust over weeks, then ask for money for emergencies, customs, or travel. Never send money to someone you have not met in person.';
  }
  if (/report|victim|lost money|scammed/.test(m)) {
    return 'If you have lost money, make a police report immediately and contact your bank to freeze transactions. You can also call the 1799 helpline. It is not your fault — scammers use sophisticated tactics.';
  }
  return 'I can help you check messages, calls, and offers for scam signs, and share prevention tips. Ask me about phishing, investment, job, romance, or government-impersonation scams — or tap Home to analyze an image, voice, or video.';
}

/** Convert a probability into a short label for the results UI. */
export function probabilityLabel(p: number): string {
  const level = riskFromProbability(p);
  const map: Record<string, string> = {
    safe: 'Very low risk',
    low: 'Low risk',
    medium: 'Possible scam',
    high: 'Likely scam',
    critical: 'Almost certainly a scam',
  };
  return map[level];
}
