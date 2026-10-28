import type { CharacterId } from '../content/voiceCast'
import { phraseId } from './clips'

/** 同一句话按说话人分开存储，动画与对话练习保持同一角色声线。 */
export function characterClipId(speaker: CharacterId, text: string): string {
  return `v/${speaker}/${phraseId(text)}`
}
