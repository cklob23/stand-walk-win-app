import type { SupabaseClient } from '@supabase/supabase-js'

const ACCESS_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateAccessCodeValue(): string {
    let code = ''
    for (let i = 0; i < 8; i++) {
        code += ACCESS_CODE_CHARS.charAt(Math.floor(Math.random() * ACCESS_CODE_CHARS.length))
    }
    return code
}

export async function generateUniqueAccessCode(
    supabase: SupabaseClient,
    maxAttempts = 10
): Promise<string | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const code = generateAccessCodeValue()
        const { data: existing } = await supabase
            .from('access_codes')
            .select('id')
            .eq('code', code)
            .maybeSingle()

        if (!existing) {
            return code
        }
    }

    return null
}
