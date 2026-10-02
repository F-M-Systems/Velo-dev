import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { pickLocale, translator } from '@velo/shared';
import { AppState } from 'react-native';

export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      // ponytail: session sits unencrypted in AsyncStorage (app sandbox only). Before store
      // release, encrypt it with a key kept in expo-secure-store.
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Token refresh must only run while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

export const t = translator(pickLocale(Intl.DateTimeFormat().resolvedOptions().locale));
