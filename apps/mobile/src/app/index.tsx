import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { supabase, t } from '@/lib/supabase';

type Club = { id: string; name: string; teams: { id: string; name: string; sport: string }[] };

export default function HomeScreen() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Bumped by pull-to-refresh to run the fetch again.
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let stale = false;
    supabase
      .from('organizations')
      .select('id, name, teams(id, name, sport)')
      .order('name')
      .then(({ data, error }) => {
        if (stale) return;
        setFailed(!!error);
        if (data) setClubs(data);
        setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [reloads]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <ThemedText type="subtitle">{t('your_clubs')}</ThemedText>
          <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut()}>
            <ThemedText type="link">{t('sign_out')}</ThemedText>
          </Pressable>
        </View>
        {failed && (
          <ThemedText type="small" accessibilityRole="alert">
            {t('error_generic')}
          </ThemedText>
        )}
        <FlatList
          data={clubs}
          keyExtractor={(club) => club.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => {
                setLoading(true);
                setReloads((n) => n + 1);
              }}
            />
          }
          ListEmptyComponent={
            loading || failed ? null : (
              <ThemedText themeColor="textSecondary">{t('no_clubs')}</ThemedText>
            )
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText>{item.name}</ThemedText>
              {item.teams.map((team) => (
                <ThemedText key={team.id} type="small" themeColor="textSecondary">
                  {[team.name, team.sport].filter(Boolean).join(' · ')}
                </ThemedText>
              ))}
            </ThemedView>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
  list: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});
