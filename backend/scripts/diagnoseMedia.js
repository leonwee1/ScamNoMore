/**
 * Diagnose why a media file transcribes badly.
 *
 *   node scripts/diagnoseMedia.js path/to/video.mp4 [language]
 *
 * Reports, in order:
 *   1. Container + stream layout (is there even an audio track?)
 *   2. Loudness (mean/max dB) and how much of the clip is silence
 *   3. The size of the audio we actually send to Whisper
 *   4. Whisper's own per-segment confidence (no_speech_prob, avg_logprob)
 *   5. Whether the transcript looks like a degenerate repetition loop
 *
 * Whisper invents fluent text when fed silence or music. The giveaway is a short
 * sentence repeated, plus a high no_speech_prob, so this prints the numbers that
 * distinguish a genuine transcript from a hallucinated one.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('ffmpeg-static');

require('dotenv/config');

const file = process.argv[2];
const language = process.argv[3];

if (!file || !fs.existsSync(file)) {
  console.error('Usage: node scripts/diagnoseMedia.js <file> [language]');
  process.exit(1);
}

const MB = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

function ffmpegRun(args) {
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  return `${r.stdout ?? ''}${r.stderr ?? ''}`;
}

console.log(`\n=== FILE ===`);
console.log(`${file}  (${MB(fs.statSync(file).size)})`);

// 1. Stream layout. ffmpeg prints this to stderr and exits non-zero with no
//    output file, which is expected here.
console.log(`\n=== STREAMS ===`);
const info = ffmpegRun(['-hide_banner', '-i', file]);
for (const line of info.split('\n')) {
  if (/Duration:|Stream #|Input #/.test(line)) console.log(line.trim());
}
if (!/Stream #\d+:\d+.*Audio:/.test(info)) {
  console.log('\n>>> NO AUDIO STREAM. Nothing can be transcribed from this file.');
  process.exit(0);
}

// 2. Loudness. Near-total silence is the main cause of hallucinated text.
console.log(`\n=== LOUDNESS ===`);
const vol = ffmpegRun(['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
const mean = /mean_volume:\s*(-?[\d.]+) dB/.exec(vol);
const max = /max_volume:\s*(-?[\d.]+) dB/.exec(vol);
console.log(`mean_volume: ${mean ? mean[1] : '?'} dB`);
console.log(`max_volume : ${max ? max[1] : '?'} dB`);
if (mean && parseFloat(mean[1]) < -50) {
  console.log('>>> Essentially silent. Whisper will invent text for this.');
} else if (mean && parseFloat(mean[1]) < -35) {
  console.log('>>> Very quiet. High risk of hallucinated or partial transcript.');
}

// 3. Silence ratio.
console.log(`\n=== SILENCE ===`);
const sil = ffmpegRun([
  '-hide_banner', '-i', file,
  '-af', 'silencedetect=noise=-40dB:d=1',
  '-f', 'null', '-',
]);
const durMatch = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(info);
const totalSec = durMatch
  ? +durMatch[1] * 3600 + +durMatch[2] * 60 + parseFloat(durMatch[3])
  : 0;
let silent = 0;
for (const m of sil.matchAll(/silence_duration:\s*([\d.]+)/g)) silent += parseFloat(m[1]);
console.log(`duration: ${totalSec.toFixed(1)}s, detected silence: ${silent.toFixed(1)}s`);
if (totalSec > 0) {
  const pct = (silent / totalSec) * 100;
  console.log(`silence: ${pct.toFixed(0)}% of the clip`);
  if (pct > 80) console.log('>>> Mostly silence — expect hallucinated output.');
}

// 4. Extract exactly what production sends to Whisper.
console.log(`\n=== EXTRACTED AUDIO (as production sends it) ===`);
const out = path.join(require('os').tmpdir(), `diag-${Date.now()}.mp3`);
ffmpegRun([
  '-hide_banner', '-loglevel', 'error',
  '-i', file,
  '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '32k',
  '-y', out,
]);
if (!fs.existsSync(out)) {
  console.log('>>> Extraction produced no file.');
  process.exit(1);
}
console.log(`${MB(fs.statSync(out).size)}  ->  ${out}`);

// 5. Ask Whisper, with per-segment confidence.
if (!process.env.OPENAI_API_KEY) {
  console.log('\n(OPENAI_API_KEY not set — skipping transcription)');
  process.exit(0);
}

(async () => {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`\n=== WHISPER (language=${language ?? 'auto-detect'}) ===`);
  const res = await client.audio.transcriptions.create({
    file: fs.createReadStream(out),
    model: process.env.OPENAI_TRANSCRIBE_MODEL ?? 'whisper-1',
    response_format: 'verbose_json',
    temperature: 0,
    ...(language ? { language } : {}),
  });

  console.log(`detected language: ${res.language}`);
  console.log(`text: ${JSON.stringify(res.text)}`);

  const segments = res.segments ?? [];
  if (segments.length) {
    console.log(`\nsegments (${segments.length}):`);
    console.log('  start   end   no_speech  avg_logprob  text');
    for (const s of segments) {
      console.log(
        `  ${s.start.toFixed(1).padStart(5)} ${s.end.toFixed(1).padStart(5)}` +
          `   ${s.no_speech_prob.toFixed(3)}      ${s.avg_logprob.toFixed(3)}    ` +
          JSON.stringify(s.text.trim())
      );
    }
    const suspect = segments.filter((s) => s.no_speech_prob > 0.5 || s.avg_logprob < -1);
    console.log(
      `\n${suspect.length}/${segments.length} segment(s) look like non-speech ` +
        `(no_speech_prob > 0.5 or avg_logprob < -1)`
    );
  }

  // Degenerate repetition check.
  const sentences = res.text
    .split(/[。．.!?！？\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = new Set(sentences);
  if (sentences.length >= 3 && unique.size === 1) {
    console.log(
      `\n>>> HALLUCINATION: the same sentence repeats ${sentences.length}x ` +
        `(${JSON.stringify([...unique][0])}). Whisper does this on silence/music.`
    );
  } else if (sentences.length > 2 && unique.size < sentences.length / 2) {
    console.log(
      `\n>>> LIKELY HALLUCINATION: only ${unique.size} unique of ${sentences.length} sentences.`
    );
  }

  fs.unlinkSync(out);
})().catch((err) => {
  console.error('\nTranscription failed:', err.message);
  process.exit(1);
});
