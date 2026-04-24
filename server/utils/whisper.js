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
// 32 kbps mono MP3 @ 16 kHz — keeps Whisper quality while staying under 25 MB
// for videos up to ~90 minutes.
function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioFrequency(16000)
      .audioChannels(1)
      .audioBitrate("32k")
      .output(audioPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

// ── Whisper transcription ─────────────────────────────────────────────────────
async function transcribeAudio(audioPath) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.audio.transcriptions.create({
    file:            fs.createReadStream(audioPath),
    model:           "whisper-1",
    response_format: "verbose_json",
  });
  return response.segments || [];
}

// ── Turkish translation via GPT-4o-mini ───────────────────────────────────────
const SYSTEM_PROMPT =
  "You are a professional subtitle translator for the adult entertainment industry. " +
  "Translate the given English subtitle lines into natural, fluent Turkish. " +
  "Translate ALL content literally and accurately — including explicit, vulgar, or sexual language — without censorship or modification. " +
  "Return ONLY a JSON array of translated strings in the same order as the input. No explanations.";

async function translateBatch(texts) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: JSON.stringify(texts) },
    ],
    temperature: 0.2,
  });

  const raw = response.choices[0].message.content.trim();
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== texts.length) throw new Error("GPT batch mismatch");
  return parsed;
}

async function translateToTurkish(segments) {
  const BATCH_SIZE = 20;
  const translated = [...segments];

  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    const batch = segments.slice(i, i + BATCH_SIZE);
    const texts = batch.map(s => s.text.trim());
    try {
      const results = await translateBatch(texts);
      results.forEach((text, j) => {
        translated[i + j] = { ...segments[i + j], text };
      });
    } catch {
      // batch başarısız olursa orijinal metni koru
    }
  }

  return translated;
}

// ── WebVTT builder ────────────────────────────────────────────────────────────
// SUBTITLE_OFFSET: positive = geciktir (önde gidiyorsa artır), negatif = öne al
const SUBTITLE_OFFSET = parseFloat(process.env.SUBTITLE_OFFSET || "0.3");

function toVttTime(sec) {
  const clamped = Math.max(0, sec);
  const h   = Math.floor(clamped / 3600);
  const m   = Math.floor((clamped % 3600) / 60);
  const s   = Math.floor(clamped % 60);
  const ms  = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(ms).padStart(3,"0")}`;
}

function buildVtt(segments) {
  const lines = ["WEBVTT", ""];
  let cue = 1;
  for (const seg of segments) {
    const text = seg.text?.trim();
    if (!text) continue;
    // Çok kısa segmentleri atla (gürültü/nefes sesleri)
    if ((seg.end - seg.start) < 0.3) continue;
    const start = seg.start + SUBTITLE_OFFSET;
    const end   = seg.end   + SUBTITLE_OFFSET;
    lines.push(String(cue++));
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
    const segments   = await transcribeAudio(audioPath);
    if (!segments.length) return null;
    const translated = await translateToTurkish(segments);
    const vtt        = buildVtt(translated);
    return await uploadVtt(vtt, videoId);
  } finally {
    try { fs.unlinkSync(audioPath); } catch {}
  }
}

module.exports = { processWhisperSubtitles };
