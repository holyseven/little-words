import cast from './voiceCast.json'

export type CharacterId = 'momo' | 'child'

export interface CharacterVoiceProfile {
  name: string
  gender: 'male' | 'female'
  /** 构建机已安装的真实语音；运行时播放随应用提供的离线音频。 */
  voice: string
  /** 生成时的词/分钟，不通过变调区分角色。 */
  rate: number
}

/** 配音生成器与播放器共用的固定角色声线。 */
export const characterVoices = cast as Record<CharacterId, CharacterVoiceProfile>
