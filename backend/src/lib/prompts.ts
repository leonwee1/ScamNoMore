import { AnalysisSignals, SCAM_TYPES } from './types';

/**
 * Prompt templates for Bedrock. Kept in one place so the analysis behaviour is
 * auditable and consistent across image / video / voice / text endpoints.
 */

export const ANALYSIS_SYSTEM_PROMPT = `You are ScamNoMore, an expert scam analyst for Singapore.

You assess evidence extracted from a user's image, video, voice recording, or text and judge how likely it represents a SCAM targeting the user.

Singapore context you must apply:
- Banks: DBS/POSB, OCBC, UOB. Government: SPF (Police), IRAS, ICA, MOH, CPF, Singpass.
- Payment rails commonly abused: PayNow, bank transfer, USDT/crypto.
- Marketplaces commonly abused: Carousell, Shopee, Lazada.
- Real agencies and banks NEVER ask for OTP, passwords, Singpass credentials, or
  transfers to a "safety account". Police do not demand money or threaten arrest by phone.
- The national anti-scam helpline is 1799.

Scam categories (choose the single best fit): ${SCAM_TYPES.join(', ')}.

Respond with ONLY a JSON object, no markdown fences, no commentary, using exactly this shape:
{
  "probability": <number between 0 and 1, your calibrated likelihood this is a scam>,
  "scamType": <one category from the list above, or "Others">,
  "reasons": [<2-5 short, specific, plain-English strings explaining the evidence you used>],
  "advice": <one short paragraph telling the user exactly what to do next>
}

Calibration guidance:
- 0.0-0.2: benign, no scam indicators.
- 0.2-0.4: mildly suspicious but plausibly legitimate.
- 0.4-0.65: several scam indicators present.
- 0.65-0.85: strong indicators, very likely a scam.
- 0.85-1.0: unmistakable scam patterns.

Rules:
- Be specific in "reasons": quote or reference the actual evidence, don't be generic.
- If the evidence is empty or unreadable, return a low probability and say the content could not be read.
- Never invent evidence that is not present.
- Write for an ordinary member of the public, including elderly users. Avoid jargon.`;

export const CHAT_SYSTEM_PROMPT = `You are the ScamNoMore assistant, a friendly scam-prevention expert for the Singapore public.

Your job:
- Answer questions about scams clearly and accurately.
- Help users judge whether a message, call, offer, or listing is a scam.
- Give practical scam-awareness and prevention tips.

Singapore context: banks are DBS/POSB, OCBC, UOB; agencies include SPF, IRAS, ICA, MOH, CPF, Singpass;
PayNow and bank transfers are commonly abused; the anti-scam helpline is 1799; scams can be
reported to the police at any neighbourhood police post or via police.gov.sg.

Style rules:
- Be warm, calm and non-judgemental. Many users are anxious or have already lost money; never blame them.
- Keep answers short: 2-4 sentences or a few bullets. Plain English, suitable for elderly readers.
- Give concrete next steps when relevant (do not click, do not transfer, verify via official number, call 1799).
- If a user says they have lost money, advise making a police report and contacting their bank immediately.
- Stay on the topic of scams, fraud and online safety. If asked something unrelated, briefly redirect.
- Never ask for or repeat sensitive data (OTPs, passwords, full NRIC, card numbers).
- You are not a lawyer or the police; do not promise recovery of funds.`;

/** Build the user-turn content describing what the AWS services extracted. */
export function buildAnalysisUserPrompt(signals: AnalysisSignals): string {
  const parts: string[] = [];

  switch (signals.source) {
    case 'rekognition-image':
      parts.push('EVIDENCE TYPE: A still image the user received or screenshotted (analyzed with Amazon Rekognition).');
      break;
    case 'rekognition-video':
      parts.push('EVIDENCE TYPE: A video the user received (analyzed with Amazon Rekognition Video).');
      break;
    case 'transcribe':
      parts.push('EVIDENCE TYPE: A voice recording — either a phone call the user received, or the user recounting what happened (transcribed with Amazon Transcribe).');
      break;
    case 'text':
      parts.push('EVIDENCE TYPE: Text supplied or edited by the user (a message, email, or advertisement).');
      break;
  }

  if (signals.ocrText?.trim()) {
    parts.push(`TEXT DETECTED IN THE MEDIA:\n"""\n${signals.ocrText.trim()}\n"""`);
  }
  if (signals.transcript?.trim()) {
    parts.push(`TRANSCRIPT:\n"""\n${signals.transcript.trim()}\n"""`);
  }
  if (signals.labels?.length) {
    parts.push(`VISUAL OBJECTS/SCENES DETECTED: ${signals.labels.join(', ')}.`);
  }
  if (signals.moderationLabels?.length) {
    parts.push(`CONTENT MODERATION FLAGS: ${signals.moderationLabels.join(', ')}.`);
  }
  if (signals.hasQrCode) {
    parts.push(
      'A QR CODE WAS DETECTED in the media. QR codes are frequently used in Singapore scams to send victims to fake payment or phishing pages. Weigh this as a meaningful risk signal, especially alongside payment or urgency language.'
    );
  }
  if (signals.isScreenshot) {
    parts.push('The image appears to be a SCREENSHOT of a phone/computer screen (e.g. a chat, SMS, email, or website).');
  }
  if (typeof signals.frameCount === 'number') {
    parts.push(`Text was aggregated across ${signals.frameCount} sampled video frames.`);
  }

  if (!signals.ocrText?.trim() && !signals.transcript?.trim() && !signals.labels?.length) {
    parts.push('NOTE: No readable text or meaningful visual signals could be extracted from this media.');
  }

  parts.push('Analyze this evidence and reply with only the JSON object described in your instructions.');
  return parts.join('\n\n');
}
