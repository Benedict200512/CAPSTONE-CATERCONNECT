import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import 'react-native-url-polyfill/auto'

// Safe storage adapter — avoids AsyncStorage crashing in Node/Metro context
const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key)
      }
      const { default: AsyncStorage } = await import(
        '@react-native-async-storage/async-storage'
      )
      return AsyncStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value)
        return
      }
      const { default: AsyncStorage } = await import(
        '@react-native-async-storage/async-storage'
      )
      await AsyncStorage.setItem(key, value)
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key)
        return
      }
      const { default: AsyncStorage } = await import(
        '@react-native-async-storage/async-storage'
      )
      await AsyncStorage.removeItem(key)
    } catch {}
  },
}

const SUPABASE_URL = 'https://qxqnebauyjxxzocratei.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_QXdUpQhbE91p-g_DCUfPZg_nrEIbQOx'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})