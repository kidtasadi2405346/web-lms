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
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Callout, CalloutType } from './callout-extension'
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
  FileCode,
  Minus,
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
  Table as TableIcon,
  Plus,
  Trash2,
  Omega,
  Eye,
  RemoveFormatting,
  RotateCcw,
  AlertTriangle,
  Info,
  CheckCircle2,
  ShieldAlert,
  Sigma,
} from 'lucide-react'
import { renderKaTeX } from '@/lib/katex-safe'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { RICH_CONTENT_PROSE_CLASSES } from './rich-content'
import { TipTapViewer } from './tiptap-viewer'
import { FontSize } from './font-size-extension'
import { CustomImage } from './custom-image-extension'
import { processImageForUpload } from '@/lib/image-processor'
import {
  ALLOWED_FONT_FAMILIES,
  ALLOWED_FONT_SIZES,
  PRESET_COLORS,
  PRESET_HIGHLIGHTS,
  ELECTRICAL_SYMBOLS,
} from './editor-constants'

interface TipTapEditorProps {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  materialId?: string
}

export function TipTapEditor({
  value = '',
  onChange,
  placeholder = 'Tulis isi materi di sini...',
  materialId = 'new',
}: TipTapEditorProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showSymbolPicker, setShowSymbolPicker] = useState(false)
  const [showCalloutMenu, setShowCalloutMenu] = useState(false)
  const [isMathModalOpen, setIsMathModalOpen] = useState(false)
  const [mathLatexInput, setMathLatexInput] = useState('')
  const [isMathBlock, setIsMathBlock] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const colorPickerRef = useRef<HTMLDivElement>(null)
  const highlightPickerRef = useRef<HTMLDivElement>(null)
  const tableMenuRef = useRef<HTMLDivElement>(null)
  const symbolPickerRef = useRef<HTMLDivElement>(null)
  const calloutMenuRef = useRef<HTMLDivElement>(null)

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

  const draftStorageKey = useMemo(() => `lms_material_draft_${materialId}`, [materialId])

  // Cek apakah ada draf tersimpan di localStorage saat mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(draftStorageKey)
      if (savedDraft && savedDraft !== value && savedDraft.trim() !== '<p></p>') {
        setHasDraft(true)
      }
    } catch { }
  }, [draftStorageKey, value])

  // Peringatan sebelum menutup browser/tab bila ada perubahan yang belum disimpan
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // Menutup popup saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setShowColorPicker(false)
      }
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(event.target as Node)) {
        setShowHighlightPicker(false)
      }
      if (tableMenuRef.current && !tableMenuRef.current.contains(event.target as Node)) {
        setShowTableMenu(false)
      }
      if (symbolPickerRef.current && !symbolPickerRef.current.contains(event.target as Node)) {
        setShowSymbolPicker(false)
      }
      if (calloutMenuRef.current && !calloutMenuRef.current.contains(event.target as Node)) {
        setShowCalloutMenu(false)
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
        codeBlock: {
          HTMLAttributes: {
            class: 'rounded-lg bg-muted p-4 font-mono text-sm border my-4 overflow-x-auto',
          },
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
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full border border-border my-4 overflow-hidden rounded-lg',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-border bg-muted/60 p-2.5 text-left font-semibold text-xs',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-border p-2.5 text-xs',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      CustomImage,
      Callout,
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
        // Tambahkan fungsi replace dan trim di akhir string untuk membersihkan karakter enter/spasi berlebih
        class: `min-h-[260px] w-full rounded-b-md px-3 py-3 focus:outline-none ${RICH_CONTENT_PROSE_CLASSES}`.replace(/\s+/g, ' ').trim(),
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
      const html = editor.getHTML()
      setIsDirty(true)
      onChange?.(html)

      // Simpan draf otomatis ke localStorage
      try {
        localStorage.setItem(draftStorageKey, html)
      } catch { }
    },
  })

  // Hitung jumlah kata dan karakter
  const { wordCount, charCount } = useMemo(() => {
    if (!editor) return { wordCount: 0, charCount: 0 }
    const text = editor.state.doc.textContent || ''
    const chars = text.length
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    return { wordCount: words, charCount: chars }
  }, [editor?.state.doc])

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

  // Pulihkan draf tersimpan
  function handleRestoreDraft() {
    try {
      const savedDraft = localStorage.getItem(draftStorageKey)
      if (savedDraft) {
        editor?.commands.setContent(savedDraft)
        onChange?.(savedDraft)
        setHasDraft(false)
      }
    } catch { }
  }

  // Buang draf
  function handleDiscardDraft() {
    try {
      localStorage.removeItem(draftStorageKey)
      setHasDraft(false)
    } catch { }
  }

  // Hapus semua format formatting pada teks terpilih
  function handleClearFormatting() {
    if (!editor) return
    editor.chain().focus().unsetAllMarks().clearNodes().run()
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
      const processed = await processImageForUpload(selectedImageFile, 1600)
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Sesi masuk tidak ditemukan. Harap muat ulang halaman.')
      }

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

      const {
        data: { publicUrl },
      } = supabase.storage.from('material-images').getPublicUrl(storagePath)

      const sizeClass = `image-size-${imageSize}`
      const alignClass = `image-align-${imageAlign}`
      const combinedClass = `${sizeClass} ${alignClass} rounded-lg shadow-sm max-w-full h-auto`

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
      {/* Banner Notifikasi Pulihkan Draf Lokal */}
      {hasDraft && (
        <div className="flex items-center justify-between gap-2 border-b bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Ditemukan draf otomatis tersimpan sebelumnya di peramban ini.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-6 text-[11px] px-2 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleRestoreDraft}
            >
              Pulihkan Draf
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
              onClick={handleDiscardDraft}
            >
              Abaikan
            </Button>
          </div>
        </div>
      )}

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
              setShowTableMenu(false)
              setShowSymbolPicker(false)
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
              setShowTableMenu(false)
              setShowSymbolPicker(false)
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

        {/* List, Quotes, Code Block, Horizontal Rule */}
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
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Blok Kode"
          aria-label="Blok Kode"
        >
          <FileCode className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Garis Pemisah Horizontal"
          aria-label="Garis Pemisah"
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-5 w-[1px] bg-border shrink-0" />

        {/* Menu Tabel (Spesifikasi Praktik & Tabel Resistor) */}
        <div className="relative inline-flex" ref={tableMenuRef}>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('table') ? 'secondary' : 'ghost'}
            className="h-8 px-2 gap-1 text-xs"
            onClick={() => {
              setShowTableMenu((prev) => !prev)
              setShowColorPicker(false)
              setShowHighlightPicker(false)
              setShowSymbolPicker(false)
            }}
            title="Kelola Tabel"
            aria-label="Tabel"
          >
            <TableIcon className="h-4 w-4" />
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>

          {showTableMenu && (
            <div className="absolute top-full left-0 mt-1 z-20 w-52 rounded-md border bg-popover p-2 shadow-md text-xs space-y-1">
              {!editor.isActive('table') ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-7 gap-1.5"
                  onClick={() => {
                    editor
                      .chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                    setShowTableMenu(false)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Sisipkan Tabel (3x3)
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7 gap-1.5"
                    onClick={() => {
                      editor.chain().focus().addRowAfter().run()
                      setShowTableMenu(false)
                    }}
                  >
                    Tambah Baris Bawah
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7 gap-1.5"
                    onClick={() => {
                      editor.chain().focus().deleteRow().run()
                      setShowTableMenu(false)
                    }}
                  >
                    Hapus Baris Ini
                  </Button>
                  <div className="h-[1px] bg-border my-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7 gap-1.5"
                    onClick={() => {
                      editor.chain().focus().addColumnAfter().run()
                      setShowTableMenu(false)
                    }}
                  >
                    Tambah Kolom Kanan
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7 gap-1.5"
                    onClick={() => {
                      editor.chain().focus().deleteColumn().run()
                      setShowTableMenu(false)
                    }}
                  >
                    Hapus Kolom Ini
                  </Button>
                  <div className="h-[1px] bg-border my-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-7 gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => {
                      editor.chain().focus().deleteTable().run()
                      setShowTableMenu(false)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus Tabel
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Pemilih Simbol Elektro & K3LH */}
        <div className="relative inline-flex" ref={symbolPickerRef}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 gap-1 text-xs"
            onClick={() => {
              setShowSymbolPicker((prev) => !prev)
              setShowColorPicker(false)
              setShowHighlightPicker(false)
              setShowTableMenu(false)
            }}
            title="Sisipkan Simbol Kelistrikan & Matematika"
            aria-label="Simbol"
          >
            <Omega className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-medium hidden sm:inline">Simbol</span>
          </Button>

          {showSymbolPicker && (
            <div className="absolute top-full left-0 mt-1 z-20 w-64 rounded-md border bg-popover p-2.5 shadow-md">
              <div className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">
                Simbol Kelistrikan & Matematika
              </div>
              <div className="grid grid-cols-6 gap-1">
                {ELECTRICAL_SYMBOLS.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    title={`${item.name} (${item.symbol})`}
                    onClick={() => {
                      editor.chain().focus().insertContent(item.symbol).run()
                      setShowSymbolPicker(false)
                    }}
                    className="h-8 w-8 rounded border border-border bg-background hover:bg-accent hover:text-accent-foreground text-sm font-semibold flex items-center justify-center transition-colors"
                  >
                    {item.symbol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Kotak Informasi / Callout (Catatan, Penting, K3LH, Tips) */}
        <div className="relative inline-flex" ref={calloutMenuRef}>
          <Button
            type="button"
            size="sm"
            variant={editor.isActive('callout') ? 'secondary' : 'ghost'}
            className="h-8 px-2 gap-1 text-xs"
            onClick={() => {
              setShowCalloutMenu((prev) => !prev)
              setShowColorPicker(false)
              setShowHighlightPicker(false)
              setShowTableMenu(false)
              setShowSymbolPicker(false)
            }}
            title="Kotak Informasi / Peringatan K3LH"
            aria-label="Kotak Informasi"
          >
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <span className="text-[11px] font-medium hidden sm:inline">Kotak Info</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>

          {showCalloutMenu && (
            <div className="absolute top-full left-0 mt-1 z-20 w-52 rounded-md border bg-popover p-2 shadow-md text-xs space-y-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-7 gap-1.5 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10"
                onClick={() => {
                  editor.chain().focus().toggleCallout({ type: 'catatan' }).run()
                  setShowCalloutMenu(false)
                }}
              >
                <Info className="h-3.5 w-3.5 text-blue-500" /> Catatan Materi
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-7 gap-1.5 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                onClick={() => {
                  editor.chain().focus().toggleCallout({ type: 'penting' }).run()
                  setShowCalloutMenu(false)
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Poin Penting
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-7 gap-1.5 text-red-700 dark:text-red-300 hover:bg-red-500/10"
                onClick={() => {
                  editor.chain().focus().toggleCallout({ type: 'k3lh' }).run()
                  setShowCalloutMenu(false)
                }}
              >
                <ShieldAlert className="h-3.5 w-3.5 text-red-600" /> Peringatan K3LH
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-7 gap-1.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => {
                  editor.chain().focus().toggleCallout({ type: 'tips' }).run()
                  setShowCalloutMenu(false)
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Tips Praktik
              </Button>
            </div>
          )}
        </div>

        {/* Rumus Matematika (KaTeX) */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2 gap-1 text-xs"
          onClick={() => {
            setMathLatexInput('')
            setIsMathBlock(false)
            setIsMathModalOpen(true)
          }}
          title="Sisipkan Rumus Matematika / Fisika (KaTeX)"
          aria-label="Rumus Matematika"
        >
          <Sigma className="h-4 w-4 text-purple-600" />
          <span className="text-[11px] font-medium hidden sm:inline">Rumus</span>
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

        {/* Hapus Format */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={handleClearFormatting}
          title="Hapus Format Teks Terpilih"
          aria-label="Hapus Format"
        >
          <RemoveFormatting className="h-4 w-4" />
        </Button>

        {/* Pratinjau Tampilan Siswa */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2 gap-1 text-xs ml-1"
          onClick={() => setIsPreviewOpen(true)}
          title="Pratinjau Tampilan Siswa"
          aria-label="Pratinjau Tampilan Siswa"
        >
          <Eye className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">Pratinjau</span>
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

      {/* Editor Content Area (dengan kontainer overflow untuk tabel responsif) */}
      <div className="overflow-x-auto w-full">
        <EditorContent editor={editor} />
      </div>

      {/* Footer Info: Jumlah Kata & Karakter */}
      <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>
            <strong>{wordCount}</strong> kata
          </span>
          <span>
            <strong>{charCount}</strong> karakter
          </span>
        </div>
        <div className="text-[10px]">
          {isDirty ? (
            <span className="text-amber-600 dark:text-amber-400">● Perubahan belum disimpan</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400">✓ Tersimpan</span>
          )}
        </div>
      </div>

      {/* Modal Dialog Pratinjau Tampilan Siswa */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="Pratinjau Tampilan Siswa"
        description="Begini tampilan konten materi yang akan dilihat oleh siswa di halaman pembelajaran."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4 max-h-[65vh] overflow-y-auto">
            <TipTapViewer content={editor.getHTML()} />
          </div>
          <div className="flex justify-end pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsPreviewOpen(false)}>
              Tutup Pratinjau
            </Button>
          </div>
        </div>
      </Modal>

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

      {/* Modal Dialog Sisipkan Rumus Matematika (KaTeX) */}
      <Modal
        isOpen={isMathModalOpen}
        onClose={() => setIsMathModalOpen(false)}
        title="Sisipkan Rumus Matematika / Fisika"
        description="Gunakan notasi LaTeX untuk merender rumus teknik elektro, daya, dan kalkulasi listrik."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="math-latex" className="text-xs font-semibold">
              Ekspresi LaTeX
            </Label>
            <Input
              id="math-latex"
              placeholder="Contoh: V = I \times R atau P = V \cdot I"
              value={mathLatexInput}
              onChange={(e) => setMathLatexInput(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          {/* Contoh Template Rumus Cepat */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground block">Template Rumus Elektro Cepat:</span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setMathLatexInput('V = I \\times R')}
                className="rounded border bg-muted/50 px-2 py-0.5 text-[11px] font-mono hover:bg-muted"
              >
                Hukum Ohm (V = I × R)
              </button>
              <button
                type="button"
                onClick={() => setMathLatexInput('P = V \\times I')}
                className="rounded border bg-muted/50 px-2 py-0.5 text-[11px] font-mono hover:bg-muted"
              >
                Daya Listrik (P = V × I)
              </button>
              <button
                type="button"
                onClick={() => setMathLatexInput('\\frac{1}{R_{tot}} = \\frac{1}{R_1} + \\frac{1}{R_2}')}
                className="rounded border bg-muted/50 px-2 py-0.5 text-[11px] font-mono hover:bg-muted"
              >
                Resistor Paralel
              </button>
              <button
                type="button"
                onClick={() => setMathLatexInput('E = P \\times t')}
                className="rounded border bg-muted/50 px-2 py-0.5 text-[11px] font-mono hover:bg-muted"
              >
                Energi Listrik
              </button>
            </div>
          </div>

          {/* Opsi Tampilan Blok vs Inline */}
          <div className="flex items-center gap-2">
            <input
              id="math-block"
              type="checkbox"
              checked={isMathBlock}
              onChange={(e) => setIsMathBlock(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="math-block" className="text-xs text-muted-foreground cursor-pointer">
              Tampilkan sebagai blok terpisah di tengah baris (Display Block)
            </label>
          </div>

          {/* Pratinjau Langsung KaTeX */}
          {mathLatexInput.trim() && (
            <div className="rounded-lg border bg-muted/30 p-3 text-center overflow-x-auto">
              <span className="text-[10px] text-muted-foreground block mb-1">Pratinjau Rumus:</span>
              <div
                dangerouslySetInnerHTML={{
                  __html: renderKaTeX(mathLatexInput, isMathBlock),
                }}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsMathModalOpen(false)}>
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!mathLatexInput.trim()}
              onClick={() => {
                if (!mathLatexInput.trim()) return
                const renderedHtml = renderKaTeX(mathLatexInput.trim(), isMathBlock)
                editor.chain().focus().insertContent(renderedHtml).run()
                setIsMathModalOpen(false)
                setMathLatexInput('')
              }}
            >
              Sisipkan Rumus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
