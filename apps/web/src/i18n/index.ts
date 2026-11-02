import polish from './pl.json' with { type: 'json' }

export type TranslationKey = keyof typeof polish

export function t(
  key: TranslationKey,
  replacements?: Readonly<Record<string, number | string>>,
): string {
  const translation = polish[key]
  if (replacements === undefined) {
    return translation
  }

  return translation.replace(/\{([^}]+)\}/gu, (placeholder, name: string) => {
    const replacement = replacements[name]
    return replacement === undefined ? placeholder : String(replacement)
  })
}
