/**
 * Cabinet IR gain staging: unity in-band gain.
 *
 * An IR file's absolute level is an accident of capture and export, so the
 * kernel is scaled so its mean power response over the guitar band
 * (100 Hz – 5 kHz, log-spaced, i.e. pink-weighted) is 0 dB. A cab then
 * leaves the loudness of the normalized NAM model essentially unchanged:
 * model-only and model → IR sit at the same level, and the engine's -18 dB
 * loudness target holds through the whole chain. Same convention as the
 * TONE3000 pedal; the ConvolverNode's own `normalize` is switched off.
 *
 * Measured directly: a 64-point DFT of the kernel at log-spaced frequencies.
 * For a 4096-tap cab that is ~256K MACs, a few ms once per IR load. Stereo
 * IRs are measured on their left channel.
 */

const BAND_LO_HZ = 100;
const BAND_HI_HZ = 5000;
const BAND_POINTS = 64;
/**
 * Sanity clamps. Boosting a quiet IR more than +24 dB is a broken file; a
 * dense multi-second reverb peaked at 0 dBFS legitimately needs -30 to
 * -40 dB, so the floor is -48 dB rather than symmetric.
 */
const MAX_BOOST_DB = 24;
const MAX_CUT_DB = 48;

export function irInBandGainDb(buffer: AudioBuffer): number {
  const taps = buffer.getChannelData(0);
  const n = taps.length;
  const sampleRate = buffer.sampleRate;
  let acc = 0;
  for (let k = 0; k < BAND_POINTS; k++) {
    const f =
      BAND_LO_HZ * Math.pow(BAND_HI_HZ / BAND_LO_HZ, k / (BAND_POINTS - 1));
    const w = (2 * Math.PI * f) / sampleRate;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    // Recurrence for cos(w·i), sin(w·i): no per-tap transcendental.
    let c = 1;
    let s = 0;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const x = taps[i];
      re += x * c;
      im += x * s;
      const c2 = c * cw - s * sw;
      s = s * cw + c * sw;
      c = c2;
    }
    acc += re * re + im * im;
  }
  const meanH2 = acc / BAND_POINTS;
  if (!(meanH2 > 0) || !Number.isFinite(meanH2)) return 0;
  const db = -10 * Math.log10(meanH2);
  return Math.max(-MAX_CUT_DB, Math.min(MAX_BOOST_DB, db));
}
