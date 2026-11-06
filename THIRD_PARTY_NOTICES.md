# 第三方语音资源

## Vosk Browser

`public/speech-runtime/vosk.js` 来自 [vosk-browser](https://github.com/ccoreilly/vosk-browser)，Apache-2.0。

## Vosk English small model

`public/speech-model/model.tar.gz` 是 `vosk-model-small-en-us-0.15`，来自 [Vosk Models](https://alphacephei.com/vosk/models)，Apache-2.0。模型只用于本地浏览器语音识别。

## Stageshow

`src/vendor/stageshow/` contains the Stage component and its direct dependencies
from [benjitaylor/skills · stageshow](https://github.com/benjitaylor/skills/tree/main/stageshow)
(version 1.1.1). The upstream package declares the MIT license. The science
illustration, motion model, narration, and lesson content are authored for this app.

## Kokoro windmill narration

The ten generated AAC narration clips in `public/audio/windmill-*.m4a` were
synthesized locally with [Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh)
(model weights licensed under Apache-2.0) through
[kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT).
The model and voice bank come from the maintainer's
[model-files-v1.1 release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1).
The web app bundles only the generated audio; it does not bundle the model,
voice bank, or Python inference runtime.

Source file SHA-256 checksums:

- `kokoro-v1.1-zh.fp16.onnx`: `a628ea5d6fbde96d1a85f691a6a00847829937f9e488021ba2c5359bc6ea08b5`
- `voices-v1.1-zh.bin`: `14cb6186c99e4f6016871405f62046c5df863ae27465cbdc4ee08be7dd703acd`
