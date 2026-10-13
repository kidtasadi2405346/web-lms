import katex from 'katex'

/**
 * Render ekspresi matematika LaTeX dengan KaTeX secara aman.
 * Menjamin trust: false agar tidak membuka celah injeksi HTML/XSS.
 */
export function renderKaTeX(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: false,
    })
  } catch (err) {
    return `<span class="text-destructive font-mono text-xs">[Rumus tidak valid: ${latex}]</span>`
  }
}
