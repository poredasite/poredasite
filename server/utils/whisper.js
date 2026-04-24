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

// ── Turkish translation via MyMemory (no content filters, no API key needed) ──
async function translateToTurkish(segments) {
  const BATCH = 10; // MyMemory has URL length limits, keep batches small
  const translated = [];

  for (let i = 0; i < segments.length; i += BATCH) {
    const batch = segments.slice(i, i + BATCH);

    await Promise.all(batch.map(async (seg, j) => {
      try {
        const q = encodeURIComponent(seg.text.trim());
        const res = await fetch(
          `https://api.mymemory.translated.net/get?q=${q}&langpair=en|tr&de=poredasite@proton.me`
        );
        const data = await res.json();
        const text = data.responseData?.translatedText || seg.text;
        translated[i + j] = { ...seg, text };
      } catch {
        translated[i + j] = seg;
      }
    }));
  }

  return translated;
}

// ── WebVTT builder ────────────────────────────────────────────────────────────
function toVttTime(sec) {
  const h   = Math.floor(sec / 3600);
  const m   = Math.floor((sec % 3600) / 60);
  const s   = Math.floor(sec % 60);
  const ms  = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(ms).padStart(3,"0")}`;
}

function buildVtt(segments) {
  const lines = ["WEBVTT", ""];
  let cue = 1;
  for (const seg of segments) {
    if (!seg.text?.trim()) continue;
    lines.push(String(cue++));
    lines.push(`${toVttTime(seg.start)} --> ${toVttTime(seg.end)}`);
    lines.push(seg.text.trim());
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
