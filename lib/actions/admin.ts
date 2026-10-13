'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { isValidIdentity, toPseudoEmail } from '@/lib/identity'

export type ActionState = {
  success?: boolean
  error?: string | null
}

// ==============================================================================
// 1. KELAS (CRUD)
// ==============================================================================

export async function createClassAction(formData: FormData): Promise<ActionState> {
  try {
    await requireRole('admin')
    const supabase = await createClient()

    const name = (formData.get('name') as string)?.trim()
    let referralCode = (formData.get('referral_code') as string)?.trim().toUpperCase()

    if (!name) return { error: 'Nama kelas wajib diisi.' }

    if (!referralCode) {
      // Buat kode otomatis jika kosong: KELAS-XXXX
      const sanitized = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6)
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
      referralCode = `${sanitized || 'CLS'}-${randomSuffix}`
    }

    if (referralCode.length < 4 || referralCode.length > 20) {
      return { error: 'Kode referral harus antara 4 sampai 20 karakter.' }
    }

    const { error } = await supabase.from('classes').insert({
      name,
      referral_code: referralCode,
    })

    if (error) {
      if (error.code === '23505') return { error: 'Kode referral ini sudah digunakan oleh kelas lain.' }
      return { error: error.message }
    }

    revalidatePath('/admin/classes')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function updateClassAction(id: string, formData: FormData): Promise<ActionState> {
  try {
    await requireRole('admin')
    const supabase = await createClient()

    const name = (formData.get('name') as string)?.trim()
    const referralCode = (formData.get('referral_code') as string)?.trim().toUpperCase()

    if (!name) return { error: 'Nama kelas wajib diisi.' }
    if (!referralCode || referralCode.length < 4 || referralCode.length > 20) {
      return { error: 'Kode referral harus antara 4 sampai 20 karakter.' }
    }

    const { error } = await supabase
      .from('classes')
      .update({ name, referral_code: referralCode })
      .eq('id', id)

    if (error) {
      if (error.code === '23505') return { error: 'Kode referral ini sudah digunakan oleh kelas lain.' }
      return { error: error.message }
    }

    revalidatePath('/admin/classes')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function deleteClassAction(id: string): Promise<ActionState> {
  try {
    await requireRole('admin')
    const supabase = await createClient()

    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/admin/classes')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

// ==============================================================================
// 2. MATA PELAJARAN (CRUD)
// ==============================================================================

export async function createSubjectAction(formData: FormData): Promise<ActionState> {
  try {
    await requireRole('admin')
    const supabase = await createClient()

    const name = (formData.get('name') as string)?.trim()
    if (!name) return { error: 'Nama mata pelajaran wajib diisi.' }

    const { error } = await supabase.from('subjects').insert({ name })
    if (error) {
      if (error.code === '23505') return { error: 'Mata pelajaran dengan nama ini sudah ada.' }
      return { error: error.message }
    }

    revalidatePath('/admin/subjects')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function updateSubjectAction(id: string, formData: FormData): Promise<ActionState> {
  try {
    await requireRole('admin')
    const supabase = await createClient()

    const name = (formData.get('name') as string)?.trim()
    if (!name) return { error: 'Nama mata pelajaran wajib diisi.' }

    const { error } = await supabase.from('subjects').update({ name }).eq('id', id)
    if (error) {
      if (error.code === '23505') return { error: 'Mata pelajaran dengan nama ini sudah ada.' }
      return { error: error.message }
    }

    revalidatePath('/admin/subjects')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function deleteSubjectAction(id: string): Promise<ActionState> {
  try {
    await requireRole('admin')
    const supabase = await createClient()

    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/admin/subjects')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

// ==============================================================================
// 3. PEMBUATAN AKUN GURU
// ==============================================================================

export async function createTeacherAccountAction(formData: FormData): Promise<ActionState> {
  try {
    await requireRole('admin')
    const supabase = await createClient()

    const name = (formData.get('name') as string)?.trim()
    const nip = (formData.get('nip') as string)?.trim()
    const password = (formData.get('password') as string)

    if (!name) return { error: 'Nama guru wajib diisi.' }
    if (!nip || !isValidIdentity(nip)) {
      return { error: 'NIP hanya boleh berupa huruf dan angka (3–30 karakter).' }
    }
    if (!password || password.length < 6) {
      return { error: 'Password minimal 6 karakter.' }
    }

    const email = toPseudoEmail(nip)

    // Cek apakah NIP/identitas sudah ada di profil
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('identity_number', nip.toLowerCase())
      .maybeSingle()

    if (existingProfile) {
      return { error: 'Guru dengan NIP ini sudah terdaftar.' }
    }

    let newUserId: string | null = null

    // Metode A: Gunakan service role key jika disiapkan
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey) {
      const adminAuthClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )

      const { data: created, error: adminErr } = await adminAuthClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (adminErr) return { error: `Gagal membuat auth: ${adminErr.message}` }
      newUserId = created.user?.id ?? null
    } else {
      // Metode B: Standalone anonymous sign-up client (tanpa sesi aktif admin terganggu)
      const standaloneClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )

      const { data: signUpData, error: signErr } = await standaloneClient.auth.signUp({
        email,
        password,
      })

      if (signErr) {
        if (signErr.message.includes('already registered')) {
          return { error: 'Akun dengan NIP ini sudah ada di Auth. Masukkan profil secara manual atau ganti NIP.' }
        }
        return { error: signErr.message }
      }

      newUserId = signUpData.user?.id ?? null
    }

    if (!newUserId) {
      return { error: 'Gagal mendapatkan ID pengguna baru.' }
    }

    // Masukkan ke tabel public.profiles dengan role teacher
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: newUserId,
      name,
      role: 'teacher',
      identity_number: nip.toLowerCase(),
    })

    if (profileErr) {
      return { error: `Akun dibuat, namun profil gagal disimpan: ${profileErr.message}` }
    }

    revalidatePath('/admin/teachers')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function deleteTeacherAction(teacherId: string): Promise<ActionState> {
  try {
    await requireRole('admin')
    const supabase = await createClient()

    // Menghapus baris profil (akan cascade on delete di auth jika ada service role)
    const { error } = await supabase.from('profiles').delete().eq('id', teacherId).eq('role', 'teacher')
    if (error) return { error: error.message }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey) {
      const adminAuthClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } },
      )
      await adminAuthClient.auth.admin.deleteUser(teacherId)
    }

    revalidatePath('/admin/teachers')
    revalidatePath('/admin/assignments')
    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

// ==============================================================================
// 4. PENUGASAN GURU (TEACHER ASSIGNMENTS)
// ==============================================================================

export async function createAssignmentAction(formData: FormData): Promise<ActionState> {
  try {
    await requireRole('admin')
    const supabase = await createClient()

    const teacherId = formData.get('teacher_id') as string
    const subjectId = formData.get('subject_id') as string
    const classId = formData.get('class_id') as string

    if (!teacherId || !subjectId || !classId) {
      return { error: 'Guru, Mata Pelajaran, dan Kelas wajib dipilih.' }
    }

    const { error } = await supabase.from('teacher_assignments').insert({
      teacher_id: teacherId,
      subject_id: subjectId,
      class_id: classId,
    })

    if (error) {
      if (error.code === '23505') {
        return { error: 'Guru ini sudah ditugaskan pada mata pelajaran dan kelas yang sama.' }
      }
      return { error: error.message }
    }

    revalidatePath('/admin/assignments')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}

export async function deleteAssignmentAction(assignmentId: string): Promise<ActionState> {
  try {
    await requireRole('admin')
    const supabase = await createClient()

    const { error } = await supabase.from('teacher_assignments').delete().eq('id', assignmentId)
    if (error) return { error: error.message }

    revalidatePath('/admin/assignments')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Terjadi kesalahan sistem.' }
  }
}
