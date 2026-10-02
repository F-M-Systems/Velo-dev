import { credentialsSchema, emailSchema, errorKey, signupSchema, type MessageKey } from '@velo/shared';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SITE_URL, supabase, t } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot';

export function SignIn() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ key: MessageKey; isError: boolean }>();

  const fail = (code: string) => setMessage({ key: errorKey(code), isError: true });
  const switchMode = (next: Mode) => {
    setMode(next);
    setMessage(undefined);
  };

  // Returns the outcome; a successful sign-in swaps this screen out via onAuthStateChange.
  async function run() {
    if (mode === 'forgot') {
      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) return fail('invalid_input');
      await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${SITE_URL}/auth/confirm?next=/account/password`,
      });
      setMode('signin');
      return setMessage({ key: 'notice_reset_sent', isError: false });
    }

    if (mode === 'signup') {
      const parsed = signupSchema.safeParse({ email, password, full_name: fullName });
      if (!parsed.success) return fail('invalid_input');
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { full_name: parsed.data.full_name },
          emailRedirectTo: `${SITE_URL}/auth/confirm`,
        },
      });
      if (error) return fail(error.code === 'weak_password' ? error.code : 'generic');
      setMode('signin');
      return setMessage({ key: 'notice_check_email', isError: false });
    }

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) return fail('invalid_input');
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) fail(error.code === 'email_not_confirmed' ? error.code : 'invalid_credentials');
  }

  async function submit() {
    setBusy(true);
    setMessage(undefined);
    try {
      await run();
    } catch {
      fail('generic');
    } finally {
      setBusy(false);
    }
  }

  const input = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];
  const action = mode === 'signup' ? 'sign_up' : mode === 'forgot' ? 'send_reset_link' : 'sign_in';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.form}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ThemedText type="subtitle">{t('app_name')}</ThemedText>
          {message && (
            <ThemedText type="small" style={message.isError && styles.error} accessibilityRole="alert">
              {t(message.key)}
            </ThemedText>
          )}

          {mode === 'signup' && (
            <TextInput
              style={input}
              placeholder={t('full_name')}
              accessibilityLabel={t('full_name')}
              placeholderTextColor={theme.textSecondary}
              autoComplete="name"
              value={fullName}
              onChangeText={setFullName}
            />
          )}
          <TextInput
            style={input}
            placeholder={t('email')}
            accessibilityLabel={t('email')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {mode !== 'forgot' && (
            <TextInput
              style={input}
              placeholder={t('password')}
              accessibilityLabel={t('password')}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
            />
          )}
          {mode === 'signup' && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('password_hint')}
            </ThemedText>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={submit}
            style={[styles.button, { backgroundColor: theme.text, opacity: busy ? 0.6 : 1 }]}>
            <ThemedText style={{ color: theme.background }}>{t(action)}</ThemedText>
          </Pressable>

          {mode === 'signin' ? (
            <>
              <Pressable accessibilityRole="button" onPress={() => switchMode('signup')}>
                <ThemedText type="link">{t('no_account')}</ThemedText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => switchMode('forgot')}>
                <ThemedText type="link">{t('forgot_password')}</ThemedText>
              </Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => switchMode('signin')}>
              <ThemedText type="link">{t('back_to_sign_in')}</ThemedText>
            </Pressable>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingVertical: 12,
  },
  error: {
    color: '#d92d20',
  },
});
