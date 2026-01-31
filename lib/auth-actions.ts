'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signUp(formData: FormData) {
  try {
    const supabase = await createClient()
    
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      },
    })

    if (error) {
      return { error: error.message }
    }

    // Check if email confirmation is required
    if (data.user && !data.session) {
      return { 
        success: true, 
        requiresVerification: true,
        email,
        message: 'We sent a 6-digit code to your email. Enter it below to verify your account.' 
      }
    }

    revalidatePath('/', 'layout')
    redirect('/onboarding')
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err
    }
    return { error: 'Unable to connect. Please try again.' }
  }
}

export async function verifyOtp(email: string, token: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (error) {
      return { error: error.message }
    }

    if (data.session) {
      revalidatePath('/', 'layout')
      return { success: true }
    }

    return { error: 'Verification failed. Please try again.' }
  } catch (err) {
    return { error: 'Unable to verify code. Please try again.' }
  }
}

export async function resendOtp(email: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      return { error: error.message }
    }

    return { success: true, message: 'A new code has been sent to your email.' }
  } catch (err) {
    return { error: 'Unable to resend code. Please try again.' }
  }
}

export async function signIn(formData: FormData) {
  try {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  } catch (err) {
    // Handle network errors gracefully
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err // Re-throw redirect errors
    }
    return { error: 'Unable to connect. Please try again.' }
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function getUser() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch {
    return null
  }
}

export async function getProfile() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return profile
  } catch {
    return null
  }
}

export async function resetPassword(formData: FormData) {
  try {
    const supabase = await createClient()
    const email = formData.get('email') as string

    // Use OTP for password reset instead of link
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      }
    })

    if (error) {
      // If user doesn't exist, show generic message for security
      if (error.message.includes('User not found')) {
        return { success: true, email, message: 'If an account exists with this email, you will receive a 6-digit code.' }
      }
      return { error: error.message }
    }

    return { success: true, email, message: 'We sent a 6-digit code to your email.' }
  } catch {
    return { error: 'Unable to send reset email. Please try again.' }
  }
}

export async function verifyPasswordResetOtp(email: string, token: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (error) {
      return { error: error.message }
    }

    if (data.session) {
      return { success: true }
    }

    return { error: 'Verification failed. Please try again.' }
  } catch {
    return { error: 'Unable to verify code. Please try again.' }
  }
}

export async function updatePassword(formData: FormData) {
  try {
    const supabase = await createClient()
    const password = formData.get('password') as string

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err
    }
    return { error: 'Unable to update password. Please try again.' }
  }
}

export async function resendPasswordResetOtp(email: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      }
    })

    if (error) {
      return { error: error.message }
    }

    return { success: true, message: 'A new code has been sent to your email.' }
  } catch {
    return { error: 'Unable to resend code. Please try again.' }
  }
}
