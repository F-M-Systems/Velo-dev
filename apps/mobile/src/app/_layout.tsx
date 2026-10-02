import type { Session } from '@supabase/supabase-js';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

import { SignIn } from '@/components/sign-in';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // undefined = still restoring the stored session
  const [session, setSession] = useState<Session | null>();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      SplashScreen.hideAsync();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {session ? <Stack screenOptions={{ headerShown: false }} /> : <SignIn />}
    </ThemeProvider>
  );
}
