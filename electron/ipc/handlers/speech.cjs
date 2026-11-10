'use strict';

/** On-device speech: model downloads, capabilities, and transcription. */

const { ipcMain } = require('electron');
const channels = require('../channels.cjs');
const { broadcast } = require('../broadcast.cjs');
const { createProgressThrottler } = require('../../lib/progressThrottler.cjs');
const { trustedHandler } = require('../../lib/ipcSecurity.cjs');
const whisperModels = require('../../lib/whisperModels.cjs');
const { getSpeechCapabilities } = require('../../lib/speechCapabilities.cjs');
const localStt = require('../../lib/localStt.cjs');

/**
 * @param {{ trust: () => unknown[], getDictationWebContents: () => any, getTrustedWebContentsList: () => any[] }} ctx - from registerHandlers.cjs
 */
function register({ trust, getTrustedWebContentsList }) {
  function broadcastWhisperModelDownloadProgress(payload) {
    broadcast(getTrustedWebContentsList(), channels.WHISPER_MODEL_DOWNLOAD_PROGRESS, payload);
  }

  ipcMain.handle(
    channels.WHISPER_MODEL_LIST,
    trustedHandler(trust, () => ({ ok: true, models: whisperModels.listWhisperModelStatus() })),
  );

  ipcMain.handle(
    channels.WHISPER_MODEL_DOWNLOAD,
    trustedHandler(trust, async (_event, payload) => {
      const modelId = typeof payload?.modelId === 'string' ? payload.modelId.trim() : '';
      if (!whisperModels.isAllowedModelId(modelId)) {
        return { ok: false, reason: 'unknown_model' };
      }
      try {
        const sendProgress = createProgressThrottler(broadcastWhisperModelDownloadProgress);
        await whisperModels.downloadWhisperModel(modelId, {
          onProgress: sendProgress,
        });
        sendProgress.flush();
        return { ok: true, models: whisperModels.listWhisperModelStatus() };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : 'download_failed',
        };
      }
    }),
  );

  ipcMain.handle(
    channels.WHISPER_MODEL_CANCEL,
    trustedHandler(trust, (_event, payload) => {
      const modelId = typeof payload?.modelId === 'string' ? payload.modelId.trim() : '';
      if (!whisperModels.isAllowedModelId(modelId)) {
        return { ok: false, reason: 'unknown_model' };
      }
      return whisperModels.cancelWhisperModelDownload(modelId);
    }),
  );

  ipcMain.handle(
    channels.WHISPER_MODEL_DELETE,
    trustedHandler(trust, (_event, payload) => {
      const modelId = typeof payload?.modelId === 'string' ? payload.modelId.trim() : '';
      if (!whisperModels.isAllowedModelId(modelId)) {
        return { ok: false, reason: 'unknown_model' };
      }
      const result = whisperModels.deleteWhisperModel(modelId);
      return { ...result, models: whisperModels.listWhisperModelStatus() };
    }),
  );

  ipcMain.handle(
    channels.SPEECH_CAPABILITIES,
    trustedHandler(trust, () => ({ ok: true, capabilities: getSpeechCapabilities() })),
  );

  ipcMain.handle(
    channels.LOCAL_STT_PRELOAD,
    trustedHandler(trust, async (_event, payload) => {
      const modelId = typeof payload?.modelId === 'string' ? payload.modelId.trim() : '';
      if (!whisperModels.isAllowedModelId(modelId)) {
        return { ok: false, reason: 'unknown_model' };
      }
      try {
        await localStt.preloadModel(modelId);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : 'preload_failed',
        };
      }
    }),
  );

  ipcMain.handle(
    channels.LOCAL_STT_TRANSCRIBE,
    trustedHandler(trust, async (_event, payload) => {
      const modelId = typeof payload?.modelId === 'string' ? payload.modelId.trim() : '';
      if (!whisperModels.isAllowedModelId(modelId)) {
        return { ok: false, reason: 'unknown_model' };
      }
      try {
        const result = await localStt.transcribeAudio(payload);
        return {
          ok: true,
          text: result.text,
          durationMs: result.durationMs ?? null,
          inferenceMs: result.inferenceMs ?? null,
          runtime: result.runtime ?? null,
        };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : 'transcribe_failed',
        };
      }
    }),
  );

  ipcMain.handle(
    channels.LOCAL_STT_RESET,
    trustedHandler(trust, async () => {
      try {
        await localStt.resetModel();
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : 'reset_failed',
        };
      }
    }),
  );

}

module.exports = { register };
