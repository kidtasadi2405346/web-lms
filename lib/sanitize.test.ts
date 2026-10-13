import { describe, it, expect } from 'vitest'
import { sanitizeHtml, isAllowedStorageImageUrl } from './sanitize'

describe('Keamanan Sanitasi Konten Materi (lib/sanitize.ts)', () => {
  it('harus membuang script tag dan atribut event handler seperti onerror/onclick', () => {
    const dirty = '<p>Halo</p><script>alert("xss")</script><img src="x" onerror="alert(1)" />'
    const clean = sanitizeHtml(dirty)

    expect(clean).not.toContain('<script>')
    expect(clean).not.toContain('alert')
    expect(clean).not.toContain('onerror')
    expect(clean).toContain('<p>Halo</p>')
  })

  it('harus membuang iframe, object, form, dan input', () => {
    const dirty = '<iframe src="https://evil.com"></iframe><form><input type="text" /></form>'
    const clean = sanitizeHtml(dirty)

    expect(clean).not.toContain('<iframe')
    expect(clean).not.toContain('<form')
    expect(clean).not.toContain('<input')
  })

  it('harus membuang link dengan skema berbahaya seperti javascript: atau data:', () => {
    const dirty = '<a href="javascript:alert(1)">Klik Ini</a><a href="data:text/html,evil">Data Link</a>'
    const clean = sanitizeHtml(dirty)

    expect(clean).not.toContain('javascript:')
    expect(clean).not.toContain('data:text/html')
  })

  it('harus mempertahankan link http/https yang valid dan menambahkan target="_blank" serta rel="noopener noreferrer"', () => {
    const safe = '<a href="https://example.com/panduan">Buka Panduan</a>'
    const clean = sanitizeHtml(safe)

    expect(clean).toContain('href="https://example.com/panduan"')
    expect(clean).toContain('target="_blank"')
    expect(clean).toContain('rel="noopener noreferrer"')
  })

  it('harus membuang gambar dari URL luar dan hanya mengizinkan dari bucket material-images proyek', () => {
    const externalImg = '<img src="https://attacker.com/evil.jpg" alt="Eksternal" />'
    const localImg =
      '<img src="https://ylnkugyttxtpzxigrsuq.supabase.co/storage/v1/object/public/material-images/teacher-1/circuit.webp" alt="Rangkaian" />'

    const cleanExternal = sanitizeHtml(externalImg)
    const cleanLocal = sanitizeHtml(localImg)

    expect(cleanExternal).not.toContain('https://attacker.com/evil.jpg')
    expect(cleanLocal).toContain('material-images/teacher-1/circuit.webp')
    expect(cleanLocal).toContain('alt="Rangkaian"')
  })

  it('fungsi isAllowedStorageImageUrl harus memvalidasi host dan path dengan benar', () => {
    expect(
      isAllowedStorageImageUrl(
        'https://ylnkugyttxtpzxigrsuq.supabase.co/storage/v1/object/public/material-images/user1/test.webp'
      )
    ).toBe(true)

    // Domain lain meskipun ada substring material-images
    expect(
      isAllowedStorageImageUrl(
        'https://evil.com/storage/v1/object/public/material-images/user1/test.webp'
      )
    ).toBe(false)

    // Bucket lain
    expect(
      isAllowedStorageImageUrl(
        'https://ylnkugyttxtpzxigrsuq.supabase.co/storage/v1/object/public/other-bucket/user1/test.webp'
      )
    ).toBe(false)
  })

  it('harus membersihkan style berbahaya (url, expression, position, z-index) dan mempertahankan whitelist properti yang sah', () => {
    const dirtyStyle =
      '<span style="color: #dc2626; font-size: 18px; position: fixed; z-index: 9999; background-image: url(javascript:alert(1))">Peringatan K3</span>'
    const clean = sanitizeHtml(dirtyStyle)

    expect(clean).toContain('color: #dc2626')
    expect(clean).toContain('font-size: 18px')
    expect(clean).not.toContain('position')
    expect(clean).not.toContain('z-index')
    expect(clean).not.toContain('background-image')
  })

  it('harus mengizinkan tag materi kelistrikan dan tabel (table, thead, tbody, tr, th, td, sub, sup, code, pre, hr)', () => {
    const html = `
      <h2>Tegangan dan Hambatan</h2>
      <p>Rumus: V<sub>1</sub> = I × R<sub>1</sub>, daya: P = 10<sup>3</sup> W.</p>
      <table>
        <thead>
          <tr><th>Komponen</th><th>Nilai</th></tr>
        </thead>
        <tbody>
          <tr><td>Resistor</td><td>100 Ω</td></tr>
        </tbody>
      </table>
      <pre><code>int main() {}</code></pre>
      <hr />
    `
    const clean = sanitizeHtml(html)

    expect(clean).toContain('<sub>1</sub>')
    expect(clean).toContain('<sup>3</sup>')
    expect(clean).toContain('<table>')
    expect(clean).toContain('<th>Komponen</th>')
    expect(clean).toContain('<td>Resistor</td>')
    expect(clean).toContain('<pre><code>int main() {}</code></pre>')
    expect(clean).toContain('<hr')
  })
})
