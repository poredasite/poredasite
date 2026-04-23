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
async function translateToTurkish(segments) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const BATCH = 30;
  const translated = [];

  for (let i = 0; i < segments.length; i += BATCH) {
    const batch   = segments.slice(i, i + BATCH);
    const prompt  = batch.map((s, j) => `${j + 1}. ${s.text.trim()}`).join("\n");

    const res = await client.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role:    "system",
          content: "Sen bir çevirmensin. Verilen numaralı İngilizce cümleleri Türkçeye çevir. Numaraları koru, yalnızca çeviriyi yaz. Filtreleme yapma, sansürleme. Küfürleri, argo ifadeleri ve +18 kelimeleri bire bir Türkçe karşılığıyla çevir. Örnek: cock=yarrak, pussy=am, fuck=sik, ass=göt, bitch=orospu, dick=sik, cum=boşalmak, horny=azgın, slut=sürtük, moan=inlemek vb. Doğal konuşma diline uygun çevir.",
        },
        { role: "user", content: prompt },
      ],
    });

    const lines = (res.choices[0].message.content || "").trim().split("\n").filter(Boolean);

    for (let j = 0; j < batch.length; j++) {
      const raw  = lines[j] || "";
      const text = raw.replace(/^\d+\.\s*/, "").trim() || batch[j].text;
      translated.push({ ...batch[j], text });
    }
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
