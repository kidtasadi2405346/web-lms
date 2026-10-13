import { Node, mergeAttributes } from '@tiptap/core'

export type CalloutType = 'catatan' | 'penting' | 'k3lh' | 'tips'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { type: CalloutType }) => ReturnType
      toggleCallout: (attributes?: { type: CalloutType }) => ReturnType
      unsetCallout: () => ReturnType
    }
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'catatan',
        parseHTML: (element) => element.getAttribute('data-callout-type') || 'catatan',
        renderHTML: (attributes) => {
          return {
            'data-callout-type': attributes.type || 'catatan',
            class: `callout-box callout-${attributes.type || 'catatan'} rounded-lg p-3.5 my-4 border-l-4`,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout-type]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes)
        },
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes)
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name)
        },
    }
  },
})
