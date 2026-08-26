import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { DeliveryCard } from '@/components/trips/DeliveryCard';
import { DeliveryDetailsModal } from '@/components/trips/DeliveryDetailsModal';
import { readCachedAssignedTrip, replaceCachedAssignedTrip } from '@/database/tripRepository';
import { getAssignedTrip } from '@/services/trips';
import type { AssignedTrip } from '@/types/trip';

type Stop = AssignedTrip['stops'][number];

const completedDeliveryStatuses = new Set(['delivered', 'completed']);

export default function CompletedDeliveriesScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const requestedTripId = Number(params.tripId || 0) || null;
  const { session, isLoading } = useAuth();
  const [trip, setTrip] = useState<AssignedTrip | null>(null);
  const [detailsStop, setDetailsStop] = useState<Stop | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState('');
  const token = session?.token;
  const driverId = session?.user.driverId;

  const load = useCallback(async () => {
    setRefreshing(true);
    const cached = await readCachedAssignedTrip(db);
    if (cached && (!requestedTripId || cached.id === requestedTripId)) setTrip(cached);

    if (!token || !driverId) {
      setRefreshing(false);
      return;
    }

    try {
      const response = await getAssignedTrip(token, driverId);
      if (response.trip && (!requestedTripId || response.trip.id === requestedTripId)) {
        await replaceCachedAssignedTrip(db, response.trip);
        setTrip(response.trip);
      }
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível atualizar as entregas concluídas.');
    } finally {
      setRefreshing(false);
    }
  }, [db, driverId, requestedTripId, token]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  if (isLoading) return <View style={styles.center}><ActivityIndicator color="#1268E8" size="large" /></View>;
  if (!session) return <Redirect href="/" />;

  const completedStops = trip?.stops.filter((stop) => completedDeliveryStatuses.has(stop.status)) ?? [];

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
      >
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>FORA DA FILA PRINCIPAL</Text>
          <Text style={styles.title}>{completedStops.length} {completedStops.length === 1 ? 'entrega concluída' : 'entregas concluídas'}</Text>
          <Text style={styles.subtitle}>Entregas cuja foto já foi reconhecida e que não exigem mais ação do motorista.</Text>
        </View>

        {completedStops.map((stop) => (
          <DeliveryCard key={stop.id} stop={stop} onDetails={() => setDetailsStop(stop)} />
        ))}

        {!refreshing && !completedStops.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhuma entrega concluída</Text>
            <Text style={styles.subtitle}>Quando uma foto for reconhecida, a entrega aparecerá aqui.</Text>
          </View>
        ) : null}

        {error ? <View style={styles.error}><Text style={styles.errorText}>{error} Os dados salvos continuam visíveis.</Text></View> : null}
      </ScrollView>
      <DeliveryDetailsModal onClose={() => setDetailsStop(null)} stop={detailsStop} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F6FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA' },
  content: { padding: 18, paddingBottom: 44, gap: 12 },
  intro: { backgroundColor: '#EAF8F0', borderColor: '#A7DFC0', borderWidth: 1, borderRadius: 18, padding: 16 },
  eyebrow: { color: '#27734C', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#145C38', fontSize: 21, fontWeight: '900', marginTop: 5 },
  subtitle: { color: '#5B697B', fontSize: 12, lineHeight: 18, marginTop: 5 },
  empty: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, borderColor: '#DCE3EB', borderWidth: 1, padding: 24 },
  emptyTitle: { color: '#24344B', fontSize: 18, fontWeight: '900' },
  error: { backgroundColor: '#FFF0F0', borderRadius: 14, padding: 14 },
  errorText: { color: '#933131', fontSize: 12, lineHeight: 18 },
});
