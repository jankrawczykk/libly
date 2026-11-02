import polish from './pl.json' with { type: 'json' }

export type TranslationKey = keyof typeof polish

export function t(key: TranslationKey): string {
  return polish[key]
}
