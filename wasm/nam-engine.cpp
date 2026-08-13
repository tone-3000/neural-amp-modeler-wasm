/**
 * Neural Amp Modeler (NAM) WebAssembly engine.
 *
 * A plain, multi-instance C API around NAM core. This module contains no Web
 * Audio or threading scaffolding: it is instantiated exactly once inside a
 * hand-written JavaScript AudioWorkletProcessor (see ui/src/engine/), which
 * owns all buffer shuttling and message-port plumbing.
 *
 * A single-threaded, non-SharedArrayBuffer module inside a JS worklet avoids
 * WebKit's per-instantiation recompile storm entirely (the cause of iOS
 * Jetsam kills with the previous Emscripten AUDIO_WORKLET design). Credits
 * for the approach are in the repo README.
 *
 * @author: @woodybury
 * @date: 2026-08-09
 */

#include <cmath>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

#include <emscripten/emscripten.h>

#include <NAM/activations.h>
#include <NAM/dsp.h>
#include <NAM/get_dsp.h>
#include <NAM/slimmable.h>

namespace
{

// Loudness-aware models are normalized to this output level, matching the
// behavior of the v1 engine (and the NAM plugin's "normalize" convention).
constexpr float kLoudnessTargetDb = -18.0f;

// I smooth the output gain with a one-pole filter so a target change while
// audio is running (e.g. on a model swap) doesn't click.
constexpr float kGainSmoothingCoeff = 0.99f;
constexpr float kGainSmoothingEpsilon = 1e-4f;

// DC blocker high-pass cutoff.
constexpr float kDcBlockerCutoffHz = 10.0f;

struct Instance
{
  std::unique_ptr<nam::DSP> model;

  float sampleRate = 48000.0f;
  int maxFrames = 128;

  // Single in-place audio buffer. JS writes input samples here, calls
  // nam_process(), and reads output samples back from the same buffer.
  std::vector<float> buffer;

  // DC blocker state (10 Hz high-pass on the model output).
  float dcBlockerCoeff = 0.0f;
  float prevDcInput = 0.0f;
  float prevDcOutput = 0.0f;

  // Smoothed output gain (loudness normalization).
  float outputGain = 1.0f;

  void UpdateDcBlockerCoeff()
  {
    const float omega = 2.0f * (float)M_PI * kDcBlockerCutoffHz / sampleRate;
    dcBlockerCoeff = 1.0f - omega;
  }

  void ResetFilters()
  {
    prevDcInput = 0.0f;
    prevDcOutput = 0.0f;
    outputGain = TargetOutputGain();
  }

  float TargetOutputGain() const
  {
    if (model != nullptr && model->HasLoudness())
      return powf(10.0f, (kLoudnessTargetDb - (float)model->GetLoudness()) * 0.05f);
    return 1.0f;
  }
};

// Instance table. Ids are 1-based slot indices; freed slots are reused.
std::vector<std::unique_ptr<Instance>> gInstances;

std::string gLastError;

Instance* GetInstance(int id)
{
  const size_t index = (size_t)(id - 1);
  if (id <= 0 || index >= gInstances.size())
    return nullptr;
  return gInstances[index].get();
}

nam::SlimmableModel* GetSlimmable(int id)
{
  Instance* instance = GetInstance(id);
  if (instance == nullptr || instance->model == nullptr)
    return nullptr;
  return dynamic_cast<nam::SlimmableModel*>(instance->model.get());
}

} // namespace

extern "C" {

/**
 * Create a processing instance.
 * @param sampleRate Audio context sample rate in Hz.
 * @param maxFrames Largest number of frames a single nam_process() call will
 *                  be asked to handle (the render quantum size, typically 128).
 * @return Instance id (> 0).
 */
EMSCRIPTEN_KEEPALIVE
int nam_createInstance(float sampleRate, int maxFrames)
{
  // The fast tanh approximation is a global NAM-core setting; enable it once.
  static bool fastTanhEnabled = false;
  if (!fastTanhEnabled)
  {
    nam::activations::Activation::enable_fast_tanh();
    fastTanhEnabled = true;
  }

  auto instance = std::make_unique<Instance>();
  instance->sampleRate = sampleRate;
  instance->maxFrames = maxFrames;
  instance->buffer.assign((size_t)maxFrames, 0.0f);
  instance->UpdateDcBlockerCoeff();

  for (size_t i = 0; i < gInstances.size(); i++)
  {
    if (gInstances[i] == nullptr)
    {
      gInstances[i] = std::move(instance);
      return (int)i + 1;
    }
  }
  gInstances.push_back(std::move(instance));
  return (int)gInstances.size();
}

/**
 * Destroy an instance and free its model and buffers.
 */
EMSCRIPTEN_KEEPALIVE
void nam_destroyInstance(int id)
{
  const size_t index = (size_t)(id - 1);
  if (id <= 0 || index >= gInstances.size())
    return;
  gInstances[index].reset();
  while (!gInstances.empty() && gInstances.back() == nullptr)
    gInstances.pop_back();
}

/**
 * Load a model from a .nam JSON string, replacing any current model.
 *
 * Not real-time safe: parses JSON, allocates the network, and prewarms it.
 * The JS layer mutes the node's output while a load is in flight.
 *
 * @param jsonStr .nam file contents (NUL-terminated JSON).
 * @param slimSize Slimmable size in [0.0, 1.0] applied when the model
 *                 implements nam::SlimmableModel (e.g. A2 models): the raw
 *                 NAM-core value passed to SetSlimmableSize(). With standard
 *                 A2 breakpoints, 0.0 selects the smallest submodel, 0.5 the
 *                 middle one, 1.0 the full model. Pass a negative value for
 *                 full size. Non-slimmable models ignore it.
 * @return 1 on success, 0 on failure (see nam_getLastError()).
 */
EMSCRIPTEN_KEEPALIVE
int nam_loadModel(int id, const char* jsonStr, float slimSize)
{
  Instance* instance = GetInstance(id);
  if (instance == nullptr)
  {
    gLastError = "invalid instance id";
    return 0;
  }

  try
  {
    // The browser has no filesystem; the .nam file contents arrive from JS as
    // a JSON string, parsed here and handed to core's json-object loader.
    std::unique_ptr<nam::DSP> model = nam::get_dsp(nlohmann::json::parse(jsonStr));
    if (model == nullptr)
    {
      gLastError = "model construction returned null";
      return 0;
    }
    if (slimSize >= 0.0f)
    {
      if (auto* slimmable = dynamic_cast<nam::SlimmableModel*>(model.get()))
        slimmable->SetSlimmableSize((double)slimSize);
    }
    // Reset() prewarms by default in NAM core >= 0.5.4, settling the network's
    // initial conditions so playback doesn't start with a transient.
    model->Reset((double)instance->sampleRate, instance->maxFrames);
    instance->model = std::move(model);
    instance->ResetFilters();
    return 1;
  }
  catch (const std::exception& e)
  {
    gLastError = e.what();
    return 0;
  }
}

/**
 * Unload the current model. The instance passes audio through unchanged until
 * another model is loaded.
 */
EMSCRIPTEN_KEEPALIVE
void nam_unloadModel(int id)
{
  Instance* instance = GetInstance(id);
  if (instance == nullptr)
    return;
  instance->model.reset();
  instance->ResetFilters();
}

/**
 * @return 1 if the instance has a model loaded.
 */
EMSCRIPTEN_KEEPALIVE
int nam_hasModel(int id)
{
  Instance* instance = GetInstance(id);
  return (instance != nullptr && instance->model != nullptr) ? 1 : 0;
}

/**
 * @return Pointer to the instance's audio buffer (maxFrames floats), or 0.
 *         JS writes input here, calls nam_process(), and reads output back.
 *         Re-derive HEAPF32 views after any call that may grow memory.
 */
EMSCRIPTEN_KEEPALIVE
float* nam_getBuffer(int id)
{
  Instance* instance = GetInstance(id);
  return instance != nullptr ? instance->buffer.data() : nullptr;
}

/**
 * Process frames in-place in the instance's buffer. Real-time safe: no
 * allocation, no exceptions. Pass-through when no model is loaded.
 */
EMSCRIPTEN_KEEPALIVE
void nam_process(int id, int frames)
{
  Instance* instance = GetInstance(id);
  if (instance == nullptr || frames <= 0 || frames > instance->maxFrames)
    return;
  if (instance->model == nullptr)
    return; // pass-through: buffer already holds the input

  float* audio = instance->buffer.data();

  // process() expects NAM_SAMPLE** (array of channel pointers); mono in-place.
  NAM_SAMPLE* inputPtr = audio;
  NAM_SAMPLE* outputPtr = audio;
  instance->model->process(&inputPtr, &outputPtr, frames);

  // Loudness normalization with light smoothing against clicks.
  const float targetGain = instance->TargetOutputGain();
  float gain = instance->outputGain;
  if (fabsf(targetGain - gain) > kGainSmoothingEpsilon)
  {
    for (int i = 0; i < frames; i++)
    {
      gain = kGainSmoothingCoeff * gain + (1.0f - kGainSmoothingCoeff) * targetGain;
      audio[i] *= gain;
    }
  }
  else
  {
    gain = targetGain;
    for (int i = 0; i < frames; i++)
      audio[i] *= gain;
  }
  instance->outputGain = gain;

  // DC blocker (10 Hz high-pass).
  const float coeff = instance->dcBlockerCoeff;
  float prevIn = instance->prevDcInput;
  float prevOut = instance->prevDcOutput;
  for (int i = 0; i < frames; i++)
  {
    const float in = audio[i];
    const float out = in - prevIn + coeff * prevOut;
    audio[i] = out;
    prevIn = in;
    prevOut = out;
  }
  instance->prevDcInput = prevIn;
  instance->prevDcOutput = prevOut;
}

/**
 * @return 1 if the loaded model supports dynamic size reduction
 *         (nam::SlimmableModel, e.g. A2 models).
 */
EMSCRIPTEN_KEEPALIVE
int nam_isSlimmable(int id)
{
  return GetSlimmable(id) != nullptr ? 1 : 0;
}

/**
 * Re-slim the loaded model without reparsing. No-op for non-slimmable models.
 * Not real-time safe.
 * @param slimSize Raw NAM-core slimmable size in [0.0, 1.0].
 */
EMSCRIPTEN_KEEPALIVE
void nam_setSlimmableSize(int id, float slimSize)
{
  if (auto* slimmable = GetSlimmable(id))
    slimmable->SetSlimmableSize((double)slimSize);
}

/**
 * @return Number of internal slimmable-size breakpoints of the loaded model
 *         (0 for non-slimmable models; 0.0 and 1.0 bounds are implied).
 */
EMSCRIPTEN_KEEPALIVE
int nam_getSlimmableBreakpointCount(int id)
{
  if (auto* slimmable = GetSlimmable(id))
    return (int)slimmable->GetSlimmableSizeBreakpoints().size();
  return 0;
}

/**
 * @return The index-th slimmable-size breakpoint in (0.0, 1.0), or -1.
 */
EMSCRIPTEN_KEEPALIVE
float nam_getSlimmableBreakpoint(int id, int index)
{
  if (auto* slimmable = GetSlimmable(id))
  {
    const std::vector<double> breakpoints = slimmable->GetSlimmableSizeBreakpoints();
    if (index >= 0 && (size_t)index < breakpoints.size())
      return (float)breakpoints[(size_t)index];
  }
  return -1.0f;
}

/**
 * @return 1 if the loaded model knows its own loudness (and is therefore
 *         normalized to -18 dB on output).
 */
EMSCRIPTEN_KEEPALIVE
int nam_hasLoudness(int id)
{
  Instance* instance = GetInstance(id);
  return (instance != nullptr && instance->model != nullptr && instance->model->HasLoudness()) ? 1 : 0;
}

/**
 * @return The loaded model's self-reported loudness in dB, or 0 when unknown.
 */
EMSCRIPTEN_KEEPALIVE
float nam_getLoudness(int id)
{
  Instance* instance = GetInstance(id);
  if (instance != nullptr && instance->model != nullptr && instance->model->HasLoudness())
    return (float)instance->model->GetLoudness();
  return 0.0f;
}

/**
 * @return The loaded model's expected sample rate in Hz, or -1 when unknown.
 */
EMSCRIPTEN_KEEPALIVE
float nam_getExpectedSampleRate(int id)
{
  Instance* instance = GetInstance(id);
  if (instance != nullptr && instance->model != nullptr)
    return (float)instance->model->GetExpectedSampleRate();
  return -1.0f;
}

/**
 * @return Description of the most recent nam_loadModel() failure.
 */
EMSCRIPTEN_KEEPALIVE
const char* nam_getLastError()
{
  return gLastError.c_str();
}

/**
 * @return NAM core version string, e.g. "0.5.4".
 */
EMSCRIPTEN_KEEPALIVE
const char* nam_getVersion()
{
  // Hardcoded to the core submodule's pinned release tag rather than derived
  // from NAM/version.h: the upstream v0.5.4 tag ships version.h with PATCH
  // mistakenly still set to 3. Update this when bumping the submodule.
  return "0.5.4";
}

} // extern "C"
