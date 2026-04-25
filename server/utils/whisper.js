"use strict";
const fs   = require("fs");
const os   = require("os");
const path = require("path");

const ffmpeg       = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3, BUCKET, CDN_URL } = require("../config/storage");

ffmpeg.setFfmpegPath(ffmpegStatic);

// ── Audio extraction ──────────────────────────────────────────────────────────
// 48 kbps mono MP3 @ 16 kHz — Whisper'ın beklediği format, 25 MB limiti altında
// ~90 dakikaya kadar güvenli.
function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioFrequency(16000)
      .audioChannels(1)
      .audioBitrate("48k")
      .output(audioPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

// ── Whisper transcription ─────────────────────────────────────────────────────
// timestamp_granularities: ["segment","word"] → kelime bazlı hassas zamanlama
async function transcribeAudio(audioPath) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.audio.transcriptions.create({
    file:                    fs.createReadStream(audioPath),
    model:                   "whisper-1",
    response_format:         "verbose_json",
    timestamp_granularities: ["segment", "word"],
  });
  return {
    segments: response.segments || [],
    words:    response.words    || [],
  };
}

// ── Smart cue building from word timestamps ───────────────────────────────────
// Cue limitleri: 4.5 saniye max, 80 karakter max, cümle sonu öncelikli bölme
const MAX_CUE_SECS  = 4.5;
const MAX_CUE_CHARS = 80;
const MIN_CUE_SECS  = 0.4;

function buildCuesFromWords(words) {
  if (!words.length) return [];
  const cues   = [];
  let start    = words[0].start;
  let buffer   = [];

  const joinWords = (ws) => ws.map(w => w.word).join("").replace(/\s+/g, " ").trim();

  const flush = (end) => {
    const text = joinWords(buffer);
    if (text && (end - start) >= MIN_CUE_SECS) {
      cues.push({ start, end, text });
    }
    buffer = [];
    start  = end;
  };

  for (const w of words) {
    buffer.push(w);
    const text        = joinWords(buffer);
    const isSentEnd   = /[.!?]["']?$/.test(w.word.trim());
    const tooLong     = (w.end - start) >= MAX_CUE_SECS;
    const tooManyChrs = text.length >= MAX_CUE_CHARS;

    if (isSentEnd || tooLong || tooManyChrs) {
      flush(w.end);
    }
  }

  if (buffer.length) flush(buffer[buffer.length - 1].end);
  return cues;
}

// ── Fallback: segment-based cue building ──────────────────────────────────────
// Word timestamps yoksa segment'leri zamana göre eşit böl.
function buildCuesFromSegments(segments) {
  const cues = [];
  for (const seg of segments) {
    const text = seg.text?.trim();
    if (!text || (seg.end - seg.start) < MIN_CUE_SECS) continue;

    const dur = seg.end - seg.start;
    if (dur > MAX_CUE_SECS) {
      // Noktalama işaretinde böl, yoksa eşit parçala
      const parts = text.split(/(?<=[.!?,;])\s+/).filter(Boolean);
      if (parts.length > 1) {
        const partDur = dur / parts.length;
        parts.forEach((part, i) => {
          cues.push({
            start: seg.start + i * partDur,
            end:   seg.start + (i + 1) * partDur,
            text:  part.trim(),
          });
        });
        continue;
      }
    }
    cues.push({ start: seg.start, end: seg.end, text });
  }
  return cues;
}

// ── Turkish translation via GPT-4o-mini ───────────────────────────────────────
const SYSTEM_PROMPT =
  "You are a professional subtitle translator for the adult entertainment industry. " +
  "You will receive a JSON object where keys are numbers and values are English subtitle lines. " +
  "Translate each value into natural, fluent Turkish. " +
  "Translate ALL content literally and accurately — including explicit, vulgar, or sexual language — without censorship or modification. " +
  "Return ONLY a JSON object with the SAME keys and translated Turkish values. Every key must be present. No explanations.";

async function translateBatch(texts) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const inputObj = Object.fromEntries(texts.map((t, i) => [i, t]));

  const response = await client.chat.completions.create({
    model:    "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: JSON.stringify(inputObj) },
    ],
    temperature: 0.2,
  });

  const raw    = response.choices[0].message.content.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/,"");
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("GPT did not return an object");

  // Key bazlı eşleştir — GPT birkaç satırı atlasa bile doğru index'e düşer
  return texts.map((orig, i) => {
    const val = parsed[i] ?? parsed[String(i)];
    return (typeof val === "string" && val.trim()) ? val : orig;
  });
}

async function translateCues(cues) {
  const BATCH_SIZE = 20;
  const translated = [...cues];

  for (let i = 0; i < cues.length; i += BATCH_SIZE) {
    const batch = cues.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);
    try {
      const results = await translateBatch(texts);
      results.forEach((text, j) => {
        translated[i + j] = { ...cues[i + j], text };
      });
    } catch (err) {
      console.error(`[Whisper] Translation batch ${i}–${i + BATCH_SIZE} failed:`, err.message);
    }
  }
  return translated;
}

// ── WebVTT builder ────────────────────────────────────────────────────────────
// SUBTITLE_OFFSET: fine-tune için — word timestamps ile genellikle 0 yeterli.
// Pozitif = geciktir, negatif = öne al.
const SUBTITLE_OFFSET = parseFloat(process.env.SUBTITLE_OFFSET || "0");

function toVttTime(sec) {
  const clamped = Math.max(0, sec + SUBTITLE_OFFSET);
  const h  = Math.floor(clamped / 3600);
  const m  = Math.floor((clamped % 3600) / 60);
  const s  = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(ms).padStart(3,"0")}`;
}

function buildVtt(cues) {
  const lines = ["WEBVTT", ""];
  let cueNum  = 1;
  for (const { start, end, text } of cues) {
    if (!text || end <= start) continue;
    lines.push(String(cueNum++));
    lines.push(`${toVttTime(start)} --> ${toVttTime(end)}`);
    lines.push(text);
    lines.push("");
  }
  return lines.join("\n");
}

// ── R2 upload ─────────────────────────────────────────────────────────────────
async function uploadVtt(vttContent, videoId) {
  const key = `subtitles/${videoId}.vtt`;
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        Buffer.from(vttContent, "utf-8"),
    ContentType: "text/vtt",
  }));
  return `${CDN_URL}/${key}`;
}

// ── Main entry point ──────────────────────────────────────────────────────────
async function processWhisperSubtitles(videoPath, videoId) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

  const audioPath = path.join(os.tmpdir(), `audio-${videoId}.mp3`);
  try {
    await extractAudio(videoPath, audioPath);

    const { segments, words } = await transcribeAudio(audioPath);
    if (!segments.length) return null;

    // Word timestamps varsa çok daha hassas zamanlama → tercih et
    const rawCues = words.length > 0
      ? buildCuesFromWords(words)
      : buildCuesFromSegments(segments);

    if (!rawCues.length) return null;

    console.log(`[Whisper] ${rawCues.length} cues (${words.length > 0 ? "word" : "segment"}-level timestamps)`);

    const translatedCues = await translateCues(rawCues);
    const vtt            = buildVtt(translatedCues);
    return await uploadVtt(vtt, videoId);
  } finally {
    try { fs.unlinkSync(audioPath); } catch {}
  }
}

module.exports = { processWhisperSubtitles };
