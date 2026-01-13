import { GoogleGenAI, Schema, Type, Part, Modality, GenerateContentResponse } from "@google/genai";
import { ProcessedData, Subtitle, Note, Flashcard, ProcessingOptions, StatusUpdateCallback } from "../types";

// --- HELPER: Get API Key ---
export const getApiKey = (): string | null => {
  // 1. Check Local Storage (User provided key)
  const localKey = localStorage.getItem("gemini_api_key");
  if (localKey && localKey.trim().length > 0) return localKey;

  // 2. Check Environment Variable (Dev provided key)
  if (process.env.API_KEY && process.env.API_KEY.length > 0) return process.env.API_KEY;

  return null;
};

// --- HELPER: Promise Wrapper for Cancellation ---
const runWithCancellation = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(new Error("Processing cancelled by user."));

    return new Promise((resolve, reject) => {
        const onAbort = () => reject(new Error("Processing cancelled by user."));
        signal.addEventListener("abort", onAbort);

        promise.then(
            (res) => {
                signal.removeEventListener("abort", onAbort);
                resolve(res);
            },
            (err) => {
                signal.removeEventListener("abort", onAbort);
                reject(err);
            }
        );
    });
};

const fileToGenerativePart = async (file: File, signal?: AbortSignal): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (signal) {
        signal.addEventListener('abort', () => {
            reader.abort();
            reject(new Error("Processing cancelled by user."));
        });
    }
    reader.onloadend = () => {
      if (reader.result) {
        const base64String = reader.result as string;
        const base64Content = base64String.split(',')[1];
        resolve(base64Content);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("Error reading file"));
    reader.readAsDataURL(file);
  });
};

const waitForFileActive = async (
  ai: GoogleGenAI, 
  fileName: string, 
  onStatusUpdate?: StatusUpdateCallback,
  signal?: AbortSignal
): Promise<void> => {
  console.log(`Waiting for file ${fileName} to become active...`);
  const maxAttempts = 120; // Increased attempts for larger files
  const delayMs = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error("Processing cancelled by user.");

    // Cast to any because the generic wrapper returns unknown in some contexts or SDK types are complex
    const fileStatus = await runWithCancellation(ai.files.get({ name: fileName }), signal) as any;
    const state = fileStatus.state;
    console.log(`File state: ${state}`);

    if (state === 'ACTIVE') return;
    if (state === 'FAILED') throw new Error("File processing failed on Gemini server.");
    
    if (onStatusUpdate) {
        const progress = 40 + Math.floor((i / maxAttempts) * 35);
        onStatusUpdate(`Google is processing video... (State: ${state})`, progress);
    }

    await new Promise<void>((resolve, reject) => {
        const abortHandler = () => {
            clearTimeout(timer);
            reject(new Error("Processing cancelled by user."));
        };
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', abortHandler);
            resolve();
        }, delayMs);
        signal?.addEventListener('abort', abortHandler);
    });
  }
  throw new Error("File upload timed out.");
};

// --- AUDIO DECODING HELPERS ---
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

// --- WAV ENCODING HELPER ---
export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  let resultBuffer: ArrayBuffer;
  
  if (numChannels === 2) {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      const interleaved = new Float32Array(left.length + right.length);
      for (let src = 0, dst = 0; src < left.length; src++, dst += 2) {
          interleaved[dst] = left[src];
          interleaved[dst + 1] = right[src];
      }
      resultBuffer = encodeWAV(interleaved, numChannels, sampleRate, bitDepth);
  } else {
      resultBuffer = encodeWAV(buffer.getChannelData(0), numChannels, sampleRate, bitDepth);
  }

  return new Blob([resultBuffer], { type: 'audio/wav' });
};

const encodeWAV = (samples: Float32Array, numChannels: number, sampleRate: number, bitDepth: number) => {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * bytesPerSample, true);

  floatTo16BitPCM(view, 44, samples);

  return buffer;
};

const floatTo16BitPCM = (output: DataView, offset: number, input: Float32Array) => {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

export const getTTSAudio = async (text: string, voiceName: string, audioContext: AudioContext): Promise<AudioBuffer> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key missing. Please set it in the main menu.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data generated");

  return await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
};

// --- MAIN PROCESS FUNCTION ---
export const processMediaWithGemini = async (
  file: File,
  options: ProcessingOptions,
  onStatusUpdate?: StatusUpdateCallback,
  signal?: AbortSignal
): Promise<ProcessedData> => {
  try {
    if (signal?.aborted) throw new Error("Processing cancelled by user.");

    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key is missing. Please click the Key icon to add your Gemini API Key.");

    const ai = new GoogleGenAI({ apiKey });
    const mimeType = file.type;
    const INLINE_SIZE_LIMIT = 20 * 1024 * 1024; 
    let mediaPart: Part;

    // STEP 1: PREPARE MEDIA
    if (file.size < INLINE_SIZE_LIMIT) {
      if (onStatusUpdate) onStatusUpdate("Optimizing small file...", 30);
      const base64Data = await fileToGenerativePart(file, signal);
      mediaPart = { inlineData: { mimeType: mimeType, data: base64Data } };
    } else {
      if (onStatusUpdate) onStatusUpdate("Uploading large file to Gemini...", 10);
      const uploadPromise = ai.files.upload({
        file: file,
        config: { displayName: file.name, mimeType: mimeType }
      });
      // Cast to any to avoid 'unknown' type errors from the wrapper
      const uploadResult = await runWithCancellation(uploadPromise, signal) as any;
      const fileUri = uploadResult.uri;
      const fileName = uploadResult.name;
      if (!fileUri || !fileName) throw new Error("Upload failed.");
      
      if (onStatusUpdate) onStatusUpdate("File uploaded. Waiting for processing...", 40);
      await waitForFileActive(ai, fileName, onStatusUpdate, signal);
      mediaPart = { fileData: { fileUri: fileUri, mimeType: mimeType } };
    }

    // STEP 2: GENERATE CONTENT
    if (onStatusUpdate) onStatusUpdate("AI is analyzing FULL content (Deep Processing)...", 80);

    // COMPRESSED SCHEMA: Use short keys (s, e, en, vi) to save tokens for long videos
    const compressedSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        subs: { // subtitles
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              i: { type: Type.INTEGER }, // id
              s: { type: Type.STRING },  // startTime
              e: { type: Type.STRING },  // endTime
              en: { type: Type.STRING }, // textOriginal
              vi: { type: Type.STRING }, // textVietnamese
            },
            required: ["i", "s", "e", "en", "vi"],
          },
        },
        nts: { // notes
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              ts: { type: Type.STRING }, // timestamp
              ti: { type: Type.STRING }, // title
              co: { type: Type.STRING }, // content
            },
            required: ["ts", "ti", "co"],
          },
        },
        cards: { // flashcards
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              t: { type: Type.STRING }, // term
              d: { type: Type.STRING }, // definition
              c: { type: Type.STRING }, // context
            },
            required: ["id", "t", "d", "c"],
          },
        },
      },
      required: ["subs", "nts", "cards"],
    };

    const langInstruction = options.originalLanguage === 'Auto Detect' 
      ? "Detect language automatically." 
      : `Original language is ${options.originalLanguage}.`;

    // Strict prompt with emphasis on VERBATIM completeness
    const promptText = `
      Task: Create a bilingual study kit from the media file.
      ${langInstruction}
      
      CRITICAL INSTRUCTIONS FOR COMPLETENESS:
      1. **VERBATIM TRANSCRIPTION**: You MUST transcribe EVERY sentence spoken, from start to finish. Do not summarize the subtitles. Do not skip fillers if they contribute to flow. 
      2. **NO GAPS**: The 'subs' array must cover the ENTIRE duration of the video. 
      3. **PRIORITY**: If the video is long, prioritize the 'subs' array quality and completeness. Reduce the number of flashcards or notes if necessary to fit the response limit.
      
      OUTPUT MAPPING (JSON):
      - 'subs': Subtitles. 
        - i: integer index (1, 2, 3...)
        - s: Start Time (HH:MM:SS)
        - e: End Time (HH:MM:SS)
        - en: Original text (Verbatim)
        - vi: Vietnamese translation (Accurate & Natural)
      
      - 'nts': Study Notes (${options.generateNotes ? "Required, approx 1 note every 2-3 mins" : "Return empty array"}).
        - Key concepts and summary of sections.

      - 'cards': Flashcards (${options.generateFlashcards ? "Required, max 10 key terms" : "Return empty array"}).
        - Important vocabulary found in the video.
    `;

    const generatePromise = ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: { parts: [mediaPart, { text: promptText }] },
      config: { 
          responseMimeType: "application/json", 
          responseSchema: compressedSchema,
          // MAXIMIZE OUTPUT: Force model to use full capacity for long transcripts
          maxOutputTokens: 8192, 
          // REMOVED thinkingConfig to avoid errors
      }
    });
    
    // Cast to GenerateContentResponse or any to fix access errors
    const response = await runWithCancellation(generatePromise, signal) as GenerateContentResponse;

    if (!response.text) throw new Error("No response from AI");
    
    // Auto-repair JSON if truncated
    let jsonText = response.text.trim();
    if (!jsonText.endsWith('}')) {
       // Attempt to find the last valid object in the array structure and close it
       const lastValidSubs = jsonText.lastIndexOf(']}');
       if (lastValidSubs !== -1) {
           jsonText = jsonText.substring(0, lastValidSubs + 2) + ',"nts":[],"cards":[]}'; 
           console.warn("JSON was truncated. Auto-repaired by closing subtitles and skipping extras.");
       } else {
           // Basic closure attempt
           jsonText += ']}';
       }
    }

    // Parse compressed JSON and map back to full interface
    const rawData = JSON.parse(jsonText);
    
    const processedData: ProcessedData = {
        subtitles: (rawData.subs || []).map((s: any) => ({
            id: s.i,
            startTime: s.s,
            endTime: s.e,
            textOriginal: s.en,
            textVietnamese: s.vi
        })),
        notes: (rawData.nts || []).map((n: any) => ({
            timestamp: n.ts,
            title: n.ti,
            content: n.co
        })),
        flashcards: (rawData.cards || []).map((c: any) => ({
            id: c.id || Math.random().toString(),
            term: c.t,
            definition: c.d,
            context: c.c
        }))
    };

    return processedData;

  } catch (error: any) {
    if (error.message === "Processing cancelled by user.") throw error;

    console.error("Gemini processing error:", error);
    const msg = error.message || '';
    if (msg.includes('429')) throw new Error("API Quota Exceeded. Please try again later.");
    if (msg.includes('503')) throw new Error("Server overloaded. Try again shortly.");
    if (msg.includes('SAFETY')) throw new Error("Content blocked by safety filters.");
    if (msg.includes('400') && msg.includes('context')) throw new Error("File too long (Context Exceeded).");
    if (msg.includes('403') || msg.includes('API Key')) throw new Error("Invalid API Key. Please check your settings.");
    
    throw error;
  }
};