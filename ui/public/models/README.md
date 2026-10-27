# Neural Amp Models

This directory contains Neural Amp Modeler (NAM) model files for amp and pedal simulation.

## Bundled demo models

The player loads **NAM A2** files only (`SlimmableContainer`, two sizes: 0.5
and 1.0, with `loudness` metadata). The bundled demos were originally A1
captures; they were migrated by reamping the
[TONE3000 sweep v3](https://www.tone3000.com/T3K-sweep-v3.wav) through each
A1 model and re-capturing the result as A2 on [TONE3000](https://www.tone3000.com).
Measured against the original A1 on a real DI (gain-matched, since the engine
normalizes loudness-aware models to −18 dB):

| File            | Gear                     | ESR vs A1 (full / slim) |
| --------------- | ------------------------ | ----------------------- |
| `deluxe-a2.nam` | Fender Deluxe Reverb     | 0.0035 / 0.013          |
| `jcm.nam`       | Marshall JCM             | 0.0024 / 0.0081         |
| `ac10.nam`      | Vox AC10                 | 0.0014 / 0.0065         |
| `dumble.nam`    | Dumble Overdrive Special | 0.0004 / 0.0007         |
| `ampeg.nam`     | Ampeg V-2                | 0.0008 / 0.0027         |
| `5153.nam`      | Boosted EVH 5153         | 0.0093 / 0.035          |
| `jc.nam`        | Roland JC-120            | 0.00005 / 0.0002        |

`deluxe.nam` is the original A1 Deluxe Reverb, kept only as the legacy-format
fixture for `tools/smoke` (the player rejects it).

## Contributing Model Files

We welcome contributions of high-quality NAM model files! These models expand the sonic palette available to users and showcase different amplifiers, pedals, and other audio gear.

### File Specifications

Please ensure your contributions meet the following specifications:

- **Format**: `.nam` file
- **Architecture**: NAM A2 (`SlimmableContainer`). Legacy single-architecture
  files (WaveNet, LSTM, ConvNet) must be re-captured first — see above.
- **Training**: Models should be properly trained and tested for quality
- **Naming**: Use descriptive filenames that indicate the gear being modeled

### How to Contribute

1. Fork this repository
2. Add your `.nam` model file(s) to the `ui/public/models/` directory
3. Update this README with your contribution details (see Contributors section below)
4. Submit a pull request

### Ideal Content

We're looking for a variety of models including:

- Amplifier models (clean, crunch, lead, high-gain)
- Overdrive and distortion pedals
- Preamp models
- Vintage and modern gear
- Boutique and classic equipment

Please use descriptive filenames that clearly identify what is being modeled (e.g., "Fender-Twin-Reverb.nam" or "Tube-Screamer-TS808.nam").

### Training Guidelines

- Use high-quality training data
- Ensure proper gain staging during capture
- Test your models before submission
- Include a brief description of the gear and settings used

## Contributors

Thank you to everyone who has contributed model files to this project!

### [@pippress](https://www.tone3000.com/pipppriss)
- 5153.nam

---

*Want to see your name here? Contribute your NAM models and help the community!*

