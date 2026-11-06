"""Render a JSON batch of local Kokoro narration requests as 24 kHz PCM WAV.

Called by gen-windmill-audio.mjs. Models must already exist locally; this script
does not download assets or call a speech service. See requirements-windmill-audio.txt.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro
from misaki import zh


MODEL_FILENAME = "kokoro-v1.1-zh.fp16.onnx"
VOICES_FILENAME = "voices-v1.1-zh.bin"
SAMPLE_RATE = 24000


def main():
    ort.disable_telemetry_events()
    ort.set_default_logger_severity(3)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--requests", type=Path, required=True)
    args = parser.parse_args()
    model_path = args.model_dir / MODEL_FILENAME
    voices_path = args.model_dir / VOICES_FILENAME
    for path in (model_path, voices_path):
        if not path.is_file():
            raise FileNotFoundError(f"Required local Kokoro file is missing: {path}")

    requests = json.loads(args.requests.read_text(encoding="utf-8"))
    if not isinstance(requests, list) or not requests:
        raise ValueError("Expected a nonempty JSON array of speech requests")
    for item in requests:
        if item.get("provider") != "kokoro-onnx" or item.get("model") != "kokoro-v1.1-zh.fp16":
            raise ValueError("Unsupported local speech provider or model")
        if not isinstance(item.get("text"), str) or not item["text"].strip():
            raise ValueError("Every speech request needs nonempty text")
        if item.get("language") not in ("cmn", "en-us"):
            raise ValueError("Unsupported narration language")
        if not isinstance(item.get("speed"), (int, float)) or not 0.5 <= item["speed"] <= 2:
            raise ValueError("Speech speed must be between 0.5 and 2")
        if not isinstance(item.get("voice"), str) or not item["voice"]:
            raise ValueError("Every speech request needs a voice")
        if not isinstance(item.get("outputWav"), str) or not Path(item["outputWav"]).is_absolute():
            raise ValueError("Every speech request needs an absolute outputWav path")

    kokoro = Kokoro(str(model_path), str(voices_path))
    chinese_g2p = zh.ZHG2P(version="1.1") if any(item["language"] == "cmn" for item in requests) else None
    for item in requests:
        text = item["text"]
        phonemes = chinese_g2p(text)[0] if item["language"] == "cmn" else text
        samples, sample_rate = kokoro.create(
            phonemes,
            voice=item["voice"],
            speed=item["speed"],
            lang=item["language"],
            is_phonemes=item["language"] == "cmn",
        )
        samples = np.asarray(samples, dtype=np.float32)
        if sample_rate != SAMPLE_RATE or samples.ndim != 1 or samples.size < SAMPLE_RATE:
            raise ValueError(f"Invalid speech output for {item.get('id', 'clip')}")
        if not np.isfinite(samples).all() or float(np.abs(samples).max()) < 0.01:
            raise ValueError(f"Empty or nonfinite speech output for {item.get('id', 'clip')}")
        output = Path(item["outputWav"])
        output.parent.mkdir(parents=True, exist_ok=True)
        sf.write(output, samples, sample_rate, subtype="PCM_16", format="WAV")
        print(f"[Kokoro] Rendered {item.get('id', output.stem)}: {samples.size / sample_rate:.2f}s", flush=True)


if __name__ == "__main__":
    main()
