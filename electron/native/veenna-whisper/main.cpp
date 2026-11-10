// veenna-whisper: on-device speech-to-text for dictation.
//
// Loads one ggml Whisper model (GPU through Metal on macOS) and keeps it
// loaded, so a dictation only pays for inference. The desktop app talks to it
// over stdin/stdout; no port is opened.
//
//   veenna-whisper --model <path to ggml .bin>
//
// Once the model is loaded and warmed it prints "ready". Each request is one
// header line, "<id> <sample count> <language>", followed by that many mono
// 16 kHz float32 little-endian samples. Each reply is one line:
// "<id> ok <text>" or "<id> err <message>". Diagnostics go to stderr.

#include "whisper.h"

#include <algorithm>
#include <cstdio>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

namespace {

constexpr int kSampleRate = 16000;
// A minute of audio is ~1M samples; this bounds one request at ten minutes.
constexpr long kMaxSamples = static_cast<long>(kSampleRate) * 600;

void quiet_log(enum ggml_log_level, const char *, void *) {}

int thread_count() {
  const unsigned hw = std::thread::hardware_concurrency();
  return static_cast<int>(std::clamp<unsigned>(hw ? hw : 4, 1, 8));
}

// Whisper takes a code ("en") or a full name ("english"); anything else is detected.
const char * language_code(const std::string & requested) {
  if (requested.empty() || requested == "auto") return "auto";
  const int id = whisper_lang_id(requested.c_str());
  return id < 0 ? "auto" : whisper_lang_str(id);
}

std::string transcribe(whisper_context * ctx, const std::vector<float> & pcm, const char * language) {
  whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
  params.n_threads = thread_count();
  params.language = language;
  params.translate = false;
  params.no_context = true;
  params.no_timestamps = true;
  params.print_special = false;
  params.print_progress = false;
  params.print_realtime = false;
  params.print_timestamps = false;
  params.suppress_blank = true;
  params.suppress_nst = true;

  if (whisper_full(ctx, params, pcm.data(), static_cast<int>(pcm.size())) != 0) {
    throw std::runtime_error("inference failed");
  }

  std::string text;
  const int segments = whisper_full_n_segments(ctx);
  for (int i = 0; i < segments; ++i) text += whisper_full_get_segment_text(ctx, i);
  // One reply is one line.
  std::replace(text.begin(), text.end(), '\n', ' ');
  std::replace(text.begin(), text.end(), '\r', ' ');
  return text;
}

}  // namespace

int main(int argc, char ** argv) {
#ifdef _WIN32
  _setmode(_fileno(stdin), _O_BINARY);
  _setmode(_fileno(stdout), _O_BINARY);
#endif
  std::ios::sync_with_stdio(false);

  std::string model;
  for (int i = 1; i + 1 < argc; ++i) {
    if (std::string(argv[i]) == "--model") model = argv[i + 1];
  }
  if (model.empty()) {
    std::fprintf(stderr, "usage: veenna-whisper --model <ggml model>\n");
    return 2;
  }

  whisper_log_set(quiet_log, nullptr);
  whisper_context_params cparams = whisper_context_default_params();
  cparams.use_gpu = true;
  cparams.flash_attn = true;
  whisper_context * ctx = whisper_init_from_file_with_params(model.c_str(), cparams);
  if (!ctx) {
    std::fprintf(stderr, "could not load model %s\n", model.c_str());
    return 1;
  }

  // The first run builds the GPU kernels; do it now, not on the first dictation.
  try {
    transcribe(ctx, std::vector<float>(kSampleRate, 0.0f), "en");
  } catch (const std::exception & error) {
    std::fprintf(stderr, "warm-up failed: %s\n", error.what());
  }
  std::cout << "ready" << std::endl;

  std::string header;
  while (std::getline(std::cin, header)) {
    if (header.empty()) continue;
    std::istringstream fields(header);
    std::string id;
    long samples = -1;
    std::string language;
    fields >> id >> samples >> language;
    if (id.empty() || samples < 0 || samples > kMaxSamples) {
      std::cerr << "bad request header" << std::endl;
      break;  // The stream can no longer be trusted to be in step.
    }

    std::vector<float> pcm(static_cast<size_t>(samples));
    if (samples > 0 &&
        !std::cin.read(reinterpret_cast<char *>(pcm.data()), samples * static_cast<long>(sizeof(float)))) {
      break;
    }

    try {
      const std::string text = samples > 0 ? transcribe(ctx, pcm, language_code(language)) : "";
      std::cout << id << " ok " << text << std::endl;
    } catch (const std::exception & error) {
      std::cout << id << " err " << error.what() << std::endl;
    }
  }

  whisper_free(ctx);
  return 0;
}
