import { Extension } from '@tiptap/core'
import '@tiptap/extension-text-style'

export type FontSizeOptions = {
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

export const ALLOWED_FONT_SIZES = ['14px', '16px', '18px', '24px', '32px'] as const
export type AllowedFontSize = typeof ALLOWED_FONT_SIZES[number]

export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes) => {
              if (!attributes.fontSize || attributes.fontSize === '16px') {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          if (!fontSize || fontSize === '16px') {
            return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
          }
          if (ALLOWED_FONT_SIZES.includes(fontSize as AllowedFontSize)) {
            return chain().setMark('textStyle', { fontSize }).run()
          }
          return false
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
        },
    }
  },
})
