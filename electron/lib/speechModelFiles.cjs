'use strict';

const WHISPER_FILES = [
  'config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'generation_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];

const CTC_FILES = [
  'config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'vocab.json',
  'special_tokens_map.json',
  'onnx/model_quantized.onnx',
];

const FAMILY_FILES = {
  whisper: WHISPER_FILES,
  ctc: CTC_FILES,
};

function getRequiredFiles(entry) {
  // whisper.cpp reads one ggml file.
  if (entry?.runtime === 'whisper-cpp') return entry.file ? [entry.file] : [];
  const family = entry?.family || 'whisper';
  return FAMILY_FILES[family] || WHISPER_FILES;
}

function catalogEntry(catalog, modelId) {
  return catalog.find((entry) => entry.id === modelId) || null;
}

function getRequiredFilesForModel(catalog, modelId) {
  return getRequiredFiles(catalogEntry(catalog, modelId));
}

module.exports = {
  WHISPER_FILES,
  CTC_FILES,
  FAMILY_FILES,
  getRequiredFiles,
  getRequiredFilesForModel,
  catalogEntry,
};
