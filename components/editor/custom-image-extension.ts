import Image from '@tiptap/extension-image'

export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: 'image-align-center image-size-medium rounded-lg',
        parseHTML: (element) => element.getAttribute('class'),
        renderHTML: (attributes) => {
          return {
            class: attributes.class || 'image-align-center image-size-medium rounded-lg',
          }
        },
      },
      loading: {
        default: 'lazy',
        renderHTML: () => ({ loading: 'lazy' }),
      },
    }
  },
})
