'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo2,
  Redo2,
  Link2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Palette,
  Highlighter,
  ChevronDown,
  X,
  ImageIcon,
  Loader2,
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { RICH_CONTENT_PROSE_CLASSES } from './rich-content'
import { FontSize } from './font-size-extension'
import { CustomImage } from './custom-image-extension'
import { processImageForUpload } from '@/lib/image-processor'
import {
  ALLOWED_FONT_FAMILIES,
  ALLOWED_FONT_SIZES,
  PRESET_COLORS,
  PRESET_HIGHLIGHTS,
} from './editor-constants'

interface TipTapEditorProps {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
}

export function TipTapEditor({ value = '', onChange, placeholder = 'Tulis isi materi di sini...' }: TipTapEditorProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const highlightPickerRef = useRef<HTMLDivElement>(null)

  // State untuk Upload Gambar
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [imageAlt, setImageAlt] = useState('')
  const [isDecorative, setIsDecorative] = useState(false)
  const [imageSize, setImageSize] = useState<'small' | 'medium' | 'full'>('medium')
  const [imageAlign, setImageAlign] = useState<'left' | 'center' | 'right'>('center')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Menutup popup saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false)
      }
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(event.target as Node)) {
        setShowHighlightPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePrepareImageFile = useCallback((file: File) => {
    setSelectedImageFile(file)
    const prev = URL.createObjectURL(file)
    setImagePreviewUrl(prev)
    setImageAlt('')
    setIsDecorative(false)
    setUploadError(null)
    setIsImageModalOpen(true)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      TextStyle,
      FontFamily.configure({
        types: ['textStyle'],
      }),
      FontSize,
      Color.configure({
        types: ['textStyle'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Subscript,
      Superscript,
      CustomImage,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline font-medium',
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `min-h-[260px] w-full rounded-b-md px-3 py-3 focus:outline-none ${RICH_CONTENT_PROSE_CLASSES}`,
      },
      handleDrop: (view, event) => {
        const hasFiles = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0
        if (hasFiles) {
          const file = event.dataTransfer.files[0]
          if (file && file.type.startsWith('image/')) {
            event.preventDefault()
            handlePrepareImageFile(file)
            return true
          }
        }
        return false
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData && event.clipboardData.items
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item && item.type.startsWith('image/')) {
              const file = item.getAsFile()
              if (file) {
                event.preventDefault()
                handlePrepareImageFile(file)
                return true
              }
            }
          }
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  if (!editor) {
    return <div className="h-64 rounded-md border bg-muted/20 animate-pulse" />
  }

  function setLink() {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Masukkan URL link:', previousUrl)

    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  async function handleConfirmUploadImage() {
    if (!selectedImageFile) return
    if (!isDecorative && !imageAlt.trim()) {
      setUploadError('Teks alternatif (alt) wajib diisi untuk aksesibilitas, atau tandai sebagai gambar dekoratif.')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      // 1. Validasi & Kompres gambar di browser (maks 1600px, WebP, < 2MB)
      const processed = await processImageForUpload(selectedImageFile, 1600)

      // 2. Dapatkan user session guru
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Sesi masuk tidak ditemukan. Harap muat ulang halaman.')
      }

      // 3. Upload ke bucket material-images: path {teacher_id}/{uuid}.{ext}
      const fileExt = processed.file.type === 'image/gif' ? 'gif' : 'webp'
      const randomId = crypto.randomUUID()
      const storagePath = `${user.id}/${randomId}.${fileExt}`

      const { error: uploadErr } = await supabase.storage
        .from('material-images')
        .upload(storagePath, processed.file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadErr) {
        throw new Error(`Gagal mengunggah gambar: ${uploadErr.message}`)
      }

      // 4. Dapatkan public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('material-images').getPublicUrl(storagePath)

      // 5. Tentukan kelas ukuran dan perataan gambar
      const sizeClass = `image-size-${imageSize}`
      const alignClass = `image-align-${imageAlign}`
      const combinedClass = `${sizeClass} ${alignClass} rounded-lg shadow-sm max-w-full h-auto`

      // 6. Sisipkan gambar ke editor
      if (editor) {
        editor
          .chain()
          .focus()
          .setImage({
            src: publicUrl,
            alt: isDecorative ? '' : imageAlt.trim(),
          })
          .updateAttributes('image', { class: combinedClass, loading: 'lazy' })
          .run()
      }

      // Reset modal state
      setIsImageModalOpen(false)
      setSelectedImageFile(null)
      setImagePreviewUrl(null)
      setImageAlt('')
    } catch (err: any) {
      setUploadError(err.message || 'Terjadi kesalahan saat memproses gambar.')
    } finally {
      setIsUploading(false)
    }
  }

  // Cari font family yang aktif
  const currentFontFamily = (() => {
    if (editor.isActive('textStyle', { fontFamily: 'serif' })) return 'serif'
    if (editor.isActive('textStyle', { fontFamily: 'monospace' })) return 'monospace'
    return 'default'
  })()

  // Cari font size yang aktif
  const currentFontSize = editor.getAttributes('textStyle').fontSize || '16px'

  return (
    <div className="flex flex-col rounded-lg border bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring">
      {/* Input File Tersembunyi untuk Sisipkan Gambar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files && files[0]) {
            handlePrepareImageFile(files[0])
            e.target.value = ''
          }
        }}
      />

      {/* Sticky Toolbar Responsif */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-muted/40 backdrop-blur-sm p-1.5 overflow-x-auto rounded-t-lg">
        {/* Pilihan Font Family */}
        <div className="relative inline-flex items-center">
          <select
            value={currentFontFamily}
            onChange={(e) => {
              const val = e.target.value
              if (val === 'default') {
                editor.chain().focus().unsetFontFamily().run()
              } else {
                editor.chain().focus().setFontFamily(val).run()
              }
            }}
            aria-label="Pilih Jenis Font"
            title="Pilih Jenis Font"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            {ALLOWED_FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Pilihan Ukuran Font */}
        <div className="relative inline-flex items-center">
          <select
            value={currentFontSize}
            onChange={(e) => {
              const val = e.target.value
              if (val === '16px') {
                editor.chain().focus().unsetFontSize().run()
              } else {
                editor.chain().focus().setFontSize(val).run()
              }
            }}
            aria-label="Pilih Ukuran Font"
            title="Pilih Ukuran Font"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            {ALLOWED_FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mx-1 h-5 w-[1px] bg-border shrink-0" />

        {/* Format Teks Dasar */}
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Tebal (Bold) - Ctrl+B"
          aria-label="Tebal (Bold)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Miring (Italic) - Ctrl+I"
          aria-label="Miring (Italic)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Garis Bawah (Underline) - Ctrl+U"
          aria-label="Garis Bawah (Underline)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Coret (Strikethrough)"
          aria-label="Coret (Strikethrough)"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        {/* Subscript & Superscript (Teknik Elektro: R1, V2, 10^3) */}
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('subscript') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          title="Subskrip (misal: R₁, V₂)"
          aria-label="Subskrip"
        >
          <SubscriptIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('superscript') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          title="Superskrip (misal: 10³, mm²)"
          aria-label="Superskrip"
        >
          <SuperscriptIcon className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-5 w-[1px] bg-border shrink-0" />

        {/* Warna Teks */}
        <div className="relative inline-flex" ref={colorPickerRef}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 gap-1 text-xs"
            onClick={() => {
              setShowColorPicker((prev) => !prev)
              setShowHighlightPicker(false)
            }}
            title="Warna Teks"
            aria-label="Pilih Warna Teks"
          >
            <Palette className="h-4 w-4 text-primary" />
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>

          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 z-20 w-48 rounded-md border bg-popover p-2 shadow-md">
              <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 px-1">
                Pilih Warna Teks
              </div>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      editor.chain().focus().setColor(c.value).run()
                      setShowColorPicker(false)
                    }}
                    className="h-6 w-full rounded border border-border transition-transform hover:scale-110 flex items-center justify-center"
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs gap-1"
                onClick={() => {
                  editor.chain().focus().unsetColor().run()
                  setShowColorPicker(false)
                }}
              >
                <X className="h-3 w-3" /> Hapus Warna
              </Button>
            </div>
          )}
        </div>

        {/* Sorotan / Highlight */}
        <div className="relative inline-flex" ref={highlightPickerRef}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 gap-1 text-xs"
            onClick={() => {
              setShowHighlightPicker((prev) => !prev)
              setShowColorPicker(false)
            }}
            title="Sorotan Teks (Highlight)"
            aria-label="Pilih Sorotan Teks"
          >
            <Highlighter className="h-4 w-4 text-amber-500" />
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>

          {showHighlightPicker && (
            <div className="absolute top-full left-0 mt-1 z-20 w-48 rounded-md border bg-popover p-2 shadow-md">
              <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 px-1">
                Pilih Warna Sorotan
              </div>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {PRESET_HIGHLIGHTS.map((h) => (
                  <button
                    key={h.value}
                    type="button"
                    title={h.label}
                    onClick={() => {
                      editor.chain().focus().setHighlight({ color: h.value }).run()
                      setShowHighlightPicker(false)
                    }}
                    className="h-6 w-full rounded border border-border transition-transform hover:scale-110"
                    style={{ backgroundColor: h.value }}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs gap-1"
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run()
                  setShowHighlightPicker(false)
                }}
              >
                <X className="h-3 w-3" /> Hapus Sorotan
              </Button>
            </div>
          )}
        </div>

        <div className="mx-1 h-5 w-[1px] bg-border shrink-0" />

        {/* Perataan Teks (Align Left, Center, Right, Justify) */}
        <Button
          type="button"
          size="sm"
          variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Rata Kiri"
          aria-label="Rata Kiri"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Rata Tengah"
          aria-label="Rata Tengah"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Rata Kanan"
          aria-label="Rata Kanan"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive({ textAlign: 'justify' }) ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="Rata Kanan Kiri (Justify)"
          aria-label="Rata Kanan Kiri"
        >
          <AlignJustify className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-5 w-[1px] bg-border shrink-0" />

        {/* Heading 2 & 3 */}
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Judul Bab (Heading 2)"
          aria-label="Judul Bab (Heading 2)"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Sub Judul (Heading 3)"
          aria-label="Sub Judul (Heading 3)"
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-5 w-[1px] bg-border shrink-0" />

        {/* List & Quotes */}
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Daftar Poin"
          aria-label="Daftar Poin"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Daftar Nomor"
          aria-label="Daftar Nomor"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Kutipan (Quote)"
          aria-label="Kutipan"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('code') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Kode Inline"
          aria-label="Kode Inline"
        >
          <Code className="h-4 w-4" />
        </Button>

        {/* Sisipkan Gambar */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          onClick={() => fileInputRef.current?.click()}
          title="Sisipkan Gambar (Upload)"
          aria-label="Sisipkan Gambar"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        {/* Sisipkan Link */}
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('link') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={setLink}
          title="Sisipkan Tautan (Link)"
          aria-label="Sisipkan Tautan"
        >
          <Link2 className="h-4 w-4" />
        </Button>

        {/* Undo / Redo */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Urungkan (Undo) - Ctrl+Z"
            aria-label="Urungkan (Undo)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Ulangi (Redo) - Ctrl+Y"
            aria-label="Ulangi (Redo)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} />

      {/* Modal Dialog Konfigurasi Gambar */}
      <Modal
        isOpen={isImageModalOpen}
        onClose={() => {
          if (!isUploading) {
            setIsImageModalOpen(false)
            setSelectedImageFile(null)
            setImagePreviewUrl(null)
          }
        }}
        title="Sisipkan Gambar Materi"
        description="Atur teks alternatif aksesibilitas, ukuran, dan posisi gambar sebelum disisipkan ke materi."
        maxWidth="md"
      >
        <div className="space-y-4">
          {/* Pratinjau Gambar */}
          {imagePreviewUrl && (
            <div className="relative rounded-lg border bg-muted/20 p-2 flex items-center justify-center max-h-48 overflow-hidden">
              <img
                src={imagePreviewUrl}
                alt="Pratinjau"
                className="max-h-44 object-contain rounded"
              />
            </div>
          )}

          {/* Teks Alternatif (Alt) */}
          <div className="space-y-1.5">
            <Label htmlFor="image-alt" className="text-xs font-semibold">
              Teks Alternatif (Alt Text) {!isDecorative && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="image-alt"
              placeholder="Contoh: Rangkaian listrik seri dengan dua resistor dan saklar"
              value={imageAlt}
              disabled={isDecorative || isUploading}
              onChange={(e) => setImageAlt(e.target.value)}
              className="text-xs"
            />
            <div className="flex items-center gap-2 mt-1">
              <input
                id="is-decorative"
                type="checkbox"
                checked={isDecorative}
                disabled={isUploading}
                onChange={(e) => {
                  setIsDecorative(e.target.checked)
                  if (e.target.checked) setImageAlt('')
                }}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="is-decorative" className="text-[11px] text-muted-foreground cursor-pointer">
                Tandai sebagai gambar dekoratif (tidak memerlukan teks deskripsi)
              </label>
            </div>
          </div>

          {/* Pilihan Ukuran & Perataan */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ukuran Tampilan</Label>
              <select
                value={imageSize}
                disabled={isUploading}
                onChange={(e) => setImageSize(e.target.value as any)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
              >
                <option value="small">Kecil (Lebar 33%)</option>
                <option value="medium">Sedang (Lebar 66%)</option>
                <option value="full">Penuh (Lebar 100%)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Posisi / Perataan</Label>
              <select
                value={imageAlign}
                disabled={isUploading}
                onChange={(e) => setImageAlign(e.target.value as any)}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
              >
                <option value="left">Rata Kiri</option>
                <option value="center">Rata Tengah</option>
                <option value="right">Rata Kanan</option>
              </select>
            </div>
          </div>

          {uploadError && (
            <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              {uploadError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => {
                setIsImageModalOpen(false)
                setSelectedImageFile(null)
                setImagePreviewUrl(null)
              }}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isUploading}
              onClick={handleConfirmUploadImage}
              className="gap-1.5"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Mengunggah...
                </>
              ) : (
                'Simpan & Sisipkan'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
