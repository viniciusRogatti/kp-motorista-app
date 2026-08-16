import * as Crypto from 'expo-crypto';
import { Redirect, Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { EnvironmentBanner } from '@/components/EnvironmentBanner';
import { ActionSheet } from '@/components/trips/ActionSheet';
import { DeliveryCard } from '@/components/trips/DeliveryCard';
import { DeliveryDetailsModal } from '@/components/trips/DeliveryDetailsModal';
import { appConfig, isNonProduction } from '@/config';
import { readCachedAssignedTrip, replaceCachedAssignedTrip } from '@/database/tripRepository';
import {
  createSimulationTrip,
  reorderSimulatedClients,
  updateSimulatedStatus,
  type SimulatedStatus,
} from '@/features/trips/simulation';
import { acceptAssignedTrip, getAssignedTrip, reorderTripStops, updateTripStopStatus } from '@/services/trips';
import {
  isBackgroundTrackingActive,
  startTripTracking,
} from '@/tasks/backgroundLocation';
import { readActiveTripTracking } from '@/tasks/tripTrackingState';
import { scheduleRouteEndReminder } from '@/services/mobileNotifications';
import type { AssignedTrip } from '@/types/trip';

type Stop = AssignedTrip['stops'][number];
type StopGroup = { key: string; stops: Stop[] };
type LoadState = 'loading' | 'ready' | 'refreshing' | 'offline';

const finalStatuses = new Set(['delivered', 'returned', 'cancelled', 'completed', 'redelivery', 'retained']);
const operationalFinalStatuses = new Set([...finalStatuses, 'delivered_pending_receipt']);

function formatTripDate(value: string) {
  const match = value.slice(0, 10).match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function clientKey(stop: Stop) {
  return stop.customerId || stop.customerName.trim().toLocaleLowerCase('pt-BR');
}

function groupStopsByClient(stops: Stop[]): StopGroup[] {
  const groups = new Map<string, Stop[]>();
  for (const stop of stops) {
    const key = clientKey(stop) || `stop-${stop.id}`;
    groups.set(key, [...(groups.get(key) ?? []), stop]);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({ key, stops: items }));
}

function SectionTitle({ title, count, subtitle }: { title: string; count: number; subtitle?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>
      <View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View>
    </View>
  );
}

let currentDragPosition = 0;
const dragPositionListeners = new Set<() => void>();

function setCurrentDragPosition(index: number) {
  if (currentDragPosition === index) return;
  currentDragPosition = index;
  dragPositionListeners.forEach((listener) => listener());
}

function dragPositionLabel(index: number) {
  return index === 0 ? 'TOPO  •  ENTREGA ATUAL' : `POSIÇÃO ${index + 1}`;
}

function DragPositionBadge() {
  const position = useSyncExternalStore(
    (listener) => {
      dragPositionListeners.add(listener);
      return () => dragPositionListeners.delete(listener);
    },
    () => currentDragPosition,
  );
  return <Text style={styles.dragPositionText}>{dragPositionLabel(position)}</Text>;
}

export default function DriverHomeScreen() {
  const db = useSQLiteContext();
  const { session, isLoading, signOut } = useAuth();
  const [trip, setTrip] = useState<AssignedTrip | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [message, setMessage] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const [detailsStop, setDetailsStop] = useState<Stop | null>(null);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [operationMessage, setOperationMessage] = useState('');
  const [statusStop, setStatusStop] = useState<Stop | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [acceptingRoute, setAcceptingRoute] = useState(false);
  const [trackingMessage, setTrackingMessage] = useState('');
  const sessionToken = session?.token;
  const sessionDriverId = session?.user.driverId;
  const operationsEnabled = appConfig.operationsMode === 'live';
  const simulationEnabled = appConfig.operationsMode === 'simulation';

  const refreshTrip = useCallback(async (showLoading = false) => {
    if (!sessionToken || !sessionDriverId) return;
    if (showLoading) setLoadState((current) => current === 'loading' ? 'loading' : 'refreshing');
    try {
      const response = await getAssignedTrip(sessionToken, sessionDriverId);
      const visibleTrip = simulationEnabled ? createSimulationTrip(response.trip) : response.trip;
      await replaceCachedAssignedTrip(db, visibleTrip);
      setTrip(visibleTrip);
      setMessage('');
      setLoadState('ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a viagem.');
      setLoadState('offline');
    }
  }, [db, sessionDriverId, sessionToken, simulationEnabled]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void (async () => {
      const cached = await readCachedAssignedTrip(db);
      if (!active) return;
      setTrip(simulationEnabled ? createSimulationTrip(cached) : cached);
      await refreshTrip(true);
    })();
    // During a simulation, only an explicit refresh should discard the local test.
    const interval = simulationEnabled ? null : setInterval(() => void refreshTrip(false), 30_000);
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [db, refreshTrip, simulationEnabled]));

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([isBackgroundTrackingActive(), readActiveTripTracking()]).then(([started, tracking]) => {
      if (active) setTrackingActive(started && Boolean(tracking));
    });
    return () => { active = false; };
  }, []));

  useEffect(() => {
    if (!trip?.tracking.acceptedAt || !sessionToken) return;
    void startTripTracking(trip.id, sessionToken, trip.tracking.stopAt)
      .then(() => setTrackingActive(true))
      .catch((error) => setTrackingMessage(error instanceof Error ? error.message : 'Nao foi possivel iniciar o rastreamento.'));
  }, [sessionToken, trip?.id, trip?.tracking.acceptedAt, trip?.tracking.stopAt]);

  useEffect(() => { void scheduleRouteEndReminder(trip?.tracking.stopAt); }, [trip?.tracking.stopAt]);

  if (isLoading) return <View style={styles.loading}><ActivityIndicator color="#1268E8" size="large" /></View>;
  if (!session) return <Redirect href="/" />;

  const displayName = session.user.name?.trim() || session.user.username;
  const openStops = trip?.stops.filter((stop) => !operationalFinalStatuses.has(stop.status)) ?? [];
  const pendingReceiptStops = trip?.stops.filter((stop) => stop.status === 'delivered_pending_receipt') ?? [];
  const finishedStops = trip?.stops.filter((stop) => finalStatuses.has(stop.status)) ?? [];
  const currentStop = openStops.find((stop) => stop.status === 'arrived')
    || openStops.find((stop) => stop.status === 'on_the_way')
    || openStops[0]
    || null;
  const currentStops = currentStop ? openStops.filter((stop) => clientKey(stop) === clientKey(currentStop)) : [];
  const currentIds = new Set(currentStops.map((stop) => stop.id));
  const nextStops = openStops.filter((stop) => !currentIds.has(stop.id));
  const draggableGroups = groupStopsByClient(openStops);
  const cities = Array.from(new Set((trip?.stops ?? []).map((stop) => stop.city.trim()).filter(Boolean)));
  const completionProgress = trip?.summary.totalStops
    ? Math.min(100, Math.max(0, (trip.summary.completedStops / trip.summary.totalStops) * 100))
    : 0;

  async function acceptRoute() {
    if (!trip || !sessionToken || acceptingRoute) return;
    setAcceptingRoute(true);
    setTrackingMessage('');
    try {
      await acceptAssignedTrip(sessionToken, trip.id, Crypto.randomUUID());
      await startTripTracking(trip.id, sessionToken, trip.tracking.stopAt);
      setTrackingActive(true);
      await refreshTrip(false);
    } catch (error) {
      setTrackingMessage(error instanceof Error ? error.message : 'Nao foi possivel aceitar a rota.');
    } finally {
      setAcceptingRoute(false);
    }
  }

  async function changeStopStatus(stop: Stop, status: 'on_the_way' | 'arrived' | 'delivered_pending_receipt') {
    if (simulationEnabled) {
      setTrip((current) => current ? updateSimulatedStatus(current, stop.id, status) : current);
      return;
    }
    if (!operationsEnabled || !sessionToken || activeOperation) return;
    setActiveOperation(`status-${stop.id}`);
    setOperationMessage('');
    try {
      await updateTripStopStatus(sessionToken, stop.id, status, Crypto.randomUUID());
      await refreshTrip(false);
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a parada.');
    } finally {
      setActiveOperation(null);
    }
  }

  function statusAction(stop: Stop) {
    if (stop.status === 'pending' || stop.status === 'assigned') {
      return {
        label: 'Iniciar trajeto',
        disabled: (!operationsEnabled && !simulationEnabled) || (!simulationEnabled && !trip?.tracking.acceptedAt),
        loading: activeOperation === `status-${stop.id}`,
        onPress: () => void changeStopStatus(stop, 'on_the_way'),
      };
    }
    if (stop.status === 'on_the_way') {
      return {
        label: 'Cheguei ao cliente',
        disabled: (!operationsEnabled && !simulationEnabled) || (!simulationEnabled && !trip?.tracking.acceptedAt),
        loading: activeOperation === `status-${stop.id}`,
        onPress: () => void changeStopStatus(stop, 'arrived'),
      };
    }
    if (stop.status === 'arrived' && simulationEnabled) {
      return {
        label: 'Registrar resultado',
        onPress: () => setStatusStop(stop),
      };
    }
    if (stop.status === 'arrived') {
      return {
        label: 'Entreguei — aguardando foto',
        disabled: !operationsEnabled || !trip?.tracking.acceptedAt,
        loading: activeOperation === `status-${stop.id}`,
        onPress: () => void changeStopStatus(stop, 'delivered_pending_receipt'),
      };
    }
    return undefined;
  }

  function applySimulatedStatus(status: SimulatedStatus) {
    if (!statusStop) return;
    setTrip((current) => current ? updateSimulatedStatus(current, statusStop.id, status) : current);
    setStatusStop(null);
  }

  function finishSimulatedDrag(groups: StopGroup[]) {
    const orderedStopIds = groups.flatMap((group) => group.stops.map((stop) => stop.id));
    setTrip((current) => current ? reorderSimulatedClients(current, orderedStopIds) : current);
  }

  async function promoteStop(stop: Stop) {
    if (!operationsEnabled || !sessionToken || !trip || !trip.tracking.acceptedAt || activeOperation) return;
    const selectedClient = clientKey(stop);
    const selectedGroup = [stop, ...openStops.filter((item) => item.id !== stop.id && clientKey(item) === selectedClient)];
    const selectedIds = new Set(selectedGroup.map((item) => item.id));
    const remainingOpen = openStops.filter((item) => !selectedIds.has(item.id));
    const orderedStops = [...selectedGroup, ...remainingOpen, ...finishedStops];

    setActiveOperation(`reorder-${stop.id}`);
    setOperationMessage('');
    try {
      await reorderTripStops(sessionToken, trip.id, orderedStops.map((item) => item.id), Crypto.randomUUID());
      if (stop.status === 'pending' || stop.status === 'assigned') {
        await updateTripStopStatus(sessionToken, stop.id, 'on_the_way', Crypto.randomUUID());
      }
      await refreshTrip(false);
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Não foi possível alterar a próxima parada.');
      await refreshTrip(false);
    } finally {
      setActiveOperation(null);
    }
  }

  function confirmPromotion(stop: Stop) {
    if (!operationsEnabled) {
      Alert.alert('Somente leitura', 'As operações estão bloqueadas nesta configuração para proteger os dados reais.');
      return;
    }
    if (!trip?.tracking.acceptedAt) {
      Alert.alert('Aceite a rota', 'Confirme o aceite da rota antes de iniciar ou reorganizar as entregas.');
      return;
    }
    const hasActiveStop = openStops.some((item) => item.status === 'on_the_way' || item.status === 'arrived');
    if (hasActiveStop) {
      Alert.alert('Entrega em andamento', 'Finalize ou interrompa a parada atual antes de escolher outra como próxima.');
      return;
    }
    Alert.alert(
      'Tornar a próxima parada?',
      `${stop.customerName || `NF ${stop.invoiceNumber}`} será movida para o topo e marcada como “A caminho”. As outras NFs do mesmo cliente irão junto.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => void promoteStop(stop) },
      ],
    );
  }

  async function logout() {
    setIsSigningOut(true);
    try { await signOut(); } finally { setIsSigningOut(false); }
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const compact = event.nativeEvent.contentOffset.y > 24;
    if (compact !== headerCompact) setHeaderCompact(compact);
  }

  const headerContent = (
    <Pressable onPress={() => setHeaderCompact(true)} style={[styles.header, headerCompact && styles.headerCompact]}>
      <Text style={[styles.greeting, headerCompact && styles.greetingCompact]}>{headerCompact ? displayName : `Olá, ${displayName}`}</Text>
      {!headerCompact ? <Text style={styles.greetingHint}>Toque ou role para recolher</Text> : trip ? <Text style={styles.compactRoute}>Rota #{trip.id} • {trip.vehicle.licensePlate}</Text> : null}
    </Pressable>
  );

  const summaryContent = trip ? (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTop}>
        <View style={styles.routeLine}>
          <Text style={styles.routeTitle}>Rota #{trip.id}</Text>
          <Text numberOfLines={1} style={styles.routeMeta}>{formatTripDate(trip.date)}  •  {trip.vehicle.licensePlate || trip.vehicle.model}</Text>
        </View>
        <Pressable onPress={() => void refreshTrip(true)} style={styles.refreshMini}>
          {loadState === 'refreshing' ? <ActivityIndicator color="#1555A0" size="small" /> : <Text style={styles.refreshMiniText}>Atualizar</Text>}
        </Pressable>
      </View>
      <View style={styles.progressHeader}>
        <Text style={styles.progressPrimary}>{trip.summary.totalStops} recebidas</Text>
        <Text style={styles.progressMeta}>{trip.summary.completedStops} finalizadas  •  {trip.summary.pendingStops} pendentes</Text>
      </View>
      <View accessibilityLabel={`${Math.round(completionProgress)} por cento concluído`} accessibilityRole="progressbar" style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${completionProgress}%` }]} />
      </View>
      <Text numberOfLines={1} style={styles.citiesText}>{cities.length ? cities.join('  •  ') : 'Cidades não informadas'}</Text>
      {!simulationEnabled ? (
        <View style={styles.trackingRow}>
          <View style={[styles.trackingDot, trip.tracking.acceptedAt && trackingActive && styles.trackingDotActive]} />
          <View style={styles.trackingCopy}>
            <Text style={styles.trackingTitle}>{trip.tracking.acceptedAt ? 'Rota aceita — localizacao automatica' : 'Rota aguardando aceite'}</Text>
            <Text style={styles.trackingHint}>{trip.tracking.acceptedAt ? 'O compartilhamento encerra no logout ou uma hora apos a rota.' : 'Ao aceitar, o rastreamento sera iniciado automaticamente.'}</Text>
          </View>
          {!trip.tracking.acceptedAt ? <Pressable disabled={acceptingRoute} onPress={() => void acceptRoute()} style={styles.trackingButton}>
            {acceptingRoute ? <ActivityIndicator color="#1555A0" size="small" /> : <Text style={styles.trackingButtonText}>Aceitar rota</Text>}
          </Pressable> : <Text style={styles.trackingLocked}>Obrigatorio</Text>}
        </View>
      ) : null}
      {trackingMessage ? <Text style={styles.trackingError}>{trackingMessage}</Text> : null}
    </View>
  ) : null;

  function renderDraggableGroup({ item, drag, isActive, getIndex }: RenderItemParams<StopGroup>) {
    const groupIndex = getIndex() ?? 0;
    return (
      <ScaleDecorator activeScale={1.025}>
        <View style={[styles.draggableGroup, isActive && styles.draggingGroup]}>
          <View style={[styles.dragLabelRow, isActive && styles.dragLabelRowActive]}>
            {isActive ? (
              <View pointerEvents="none" style={styles.dragPositionBadge}>
                <DragPositionBadge />
              </View>
            ) : (
              <>
                <Text style={[styles.dragLabel, groupIndex === 0 && styles.dragLabelCurrent]}>
                  {groupIndex === 0 ? 'AGORA' : `PARADA ${groupIndex + 1}`}
                </Text>
                <Text style={styles.dragHandle}>≡  segure e arraste</Text>
              </>
            )}
          </View>
          {item.stops.map((stop, stopIndex) => (
            <DeliveryCard
              key={stop.id}
              stop={stop}
              prominent={groupIndex === 0 && stopIndex === 0}
              onDetails={() => setDetailsStop(stop)}
              onLongPress={drag}
              longPressHint="Segure e arraste para reordenar"
              primaryAction={groupIndex === 0 ? statusAction(stop) : undefined}
            />
          ))}
        </View>
      </ScaleDecorator>
    );
  }

  const finishedContent = finishedStops.length ? (
    <View style={styles.section}>
      <SectionTitle title="Finalizadas e devolvidas" count={finishedStops.length} />
      {finishedStops.map((stop) => (
        <DeliveryCard
          key={stop.id}
          stop={stop}
          longPressHint={simulationEnabled ? 'Segure para corrigir o status' : undefined}
          onDetails={() => setDetailsStop(stop)}
          onLongPress={simulationEnabled ? () => setStatusStop(stop) : undefined}
        />
      ))}
    </View>
  ) : null;

  const pendingReceiptsContent = pendingReceiptStops.length ? (
    <View style={styles.section}>
      <SectionTitle title="Entregues — falta foto" count={pendingReceiptStops.length} subtitle="Poste no grupo indicado para finalizar" />
      {pendingReceiptStops.map((stop) => <DeliveryCard key={stop.id} stop={stop} onDetails={() => setDetailsStop(stop)} />)}
      <Link href={{ pathname: '/pending-receipts', params: { tripId: String(trip?.id || '') } } as never} asChild>
        <Pressable style={styles.pendingReceiptButton}><Text style={styles.pendingReceiptButtonText}>Ver NFs e grupos de WhatsApp</Text></Pressable>
      </Link>
    </View>
  ) : null;

  const footerContent = (
    <View style={styles.listFooter}>
      {finishedContent}
      {pendingReceiptsContent}
      {message ? <View style={styles.offlineBox}><Text style={styles.offlineText}>{message} O último roteiro salvo continua visível.</Text></View> : null}
      {operationMessage ? <View style={styles.operationBox}><Text style={styles.operationText}>{operationMessage}</Text></View> : null}
      <View style={styles.footerActions}>
        {isNonProduction ? <Link href="/diagnostics" asChild><Pressable style={styles.footerButton}><Text style={styles.footerButtonText}>Diagnóstico</Text></Pressable></Link> : null}
        <Pressable disabled={isSigningOut} onPress={() => void logout()} style={styles.footerButton}>
          {isSigningOut ? <ActivityIndicator color="#A42323" /> : <Text style={styles.logoutText}>Sair</Text>}
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <EnvironmentBanner />
      {simulationEnabled && trip ? (
        <DraggableFlatList
          activationDistance={8}
          animationConfig={{ damping: 22, stiffness: 210, mass: 0.55 }}
          autoscrollSpeed={140}
          autoscrollThreshold={190}
          contentContainerStyle={styles.content}
          data={draggableGroups}
          dragItemOverflow
          keyExtractor={(group) => group.key}
          ListHeaderComponent={<View style={styles.listHeader}>{headerContent}{summaryContent}<View style={styles.section}><SectionTitle title="Entregas" count={openStops.length} subtitle="Segure um card e arraste para mudar a ordem" /></View></View>}
          ListFooterComponent={footerContent}
          onDragBegin={setCurrentDragPosition}
          onDragEnd={({ data }) => finishSimulatedDrag(data)}
          onPlaceholderIndexChange={setCurrentDragPosition}
          onScroll={onScroll}
          renderItem={renderDraggableGroup}
          scrollEventThrottle={32}
        />
      ) : <ScrollView
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={32}
        stickyHeaderIndices={[0]}
      >
        {headerContent}

        {loadState === 'loading' && !trip ? (
          <View style={styles.emptyCard}><ActivityIndicator color="#1268E8" /><Text style={styles.emptyText}>Buscando viagem atribuída…</Text></View>
        ) : trip ? (
          <>
            {summaryContent}

            {currentStops.length ? (
              <View style={styles.section}>
                <SectionTitle title="Agora" count={currentStops.length} subtitle={currentStops.length > 1 ? 'Notas do mesmo cliente' : 'Próxima entrega'} />
                {currentStops.map((stop, index) => (
                  <DeliveryCard
                    key={stop.id}
                    stop={stop}
                    prominent={index === 0}
                    onDetails={() => setDetailsStop(stop)}
                    primaryAction={statusAction(stop)}
                  />
                ))}
              </View>
            ) : null}

            {nextStops.length ? (
              <View style={styles.section}>
                <SectionTitle title="Próximas paradas" count={nextStops.length} subtitle="Segure uma entrega para torná-la a próxima" />
                {nextStops.map((stop) => (
                  <DeliveryCard
                    key={stop.id}
                    stop={stop}
                    onDetails={() => setDetailsStop(stop)}
                    longPressHint="Segure para reorganizar"
                    onLongPress={() => confirmPromotion(stop)}
                  />
                ))}
              </View>
            ) : null}

            {pendingReceiptsContent}
            {finishedContent}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma viagem disponível</Text>
            <Text style={styles.emptyText}>Assim que uma rota for criada para este motorista, ela aparecerá automaticamente aqui.</Text>
            <Pressable onPress={() => void refreshTrip(true)} style={styles.emptyAction}><Text style={styles.emptyActionText}>Atualizar agora</Text></Pressable>
          </View>
        )}

        {message ? <View style={styles.offlineBox}><Text style={styles.offlineText}>{message} O último roteiro salvo continua visível.</Text></View> : null}
        {operationMessage ? <View style={styles.operationBox}><Text style={styles.operationText}>{operationMessage}</Text></View> : null}

        <View style={styles.footerActions}>
          {isNonProduction ? <Link href="/diagnostics" asChild><Pressable style={styles.footerButton}><Text style={styles.footerButtonText}>Diagnóstico</Text></Pressable></Link> : null}
          <Pressable disabled={isSigningOut} onPress={() => void logout()} style={styles.footerButton}>
            {isSigningOut ? <ActivityIndicator color="#A42323" /> : <Text style={styles.logoutText}>Sair</Text>}
          </Pressable>
        </View>
      </ScrollView>}
      <DeliveryDetailsModal onClose={() => setDetailsStop(null)} stop={detailsStop} />
      <ActionSheet
        actions={[
          { label: 'Pendente', onPress: () => applySimulatedStatus('pending') },
          { label: 'Entregue', onPress: () => applySimulatedStatus('delivered') },
          { label: 'Devolvida', tone: 'danger', onPress: () => applySimulatedStatus('returned') },
          { label: 'Reentrega', onPress: () => applySimulatedStatus('redelivery') },
          { label: 'Retida', onPress: () => applySimulatedStatus('retained') },
        ]}
        onClose={() => setStatusStop(null)}
        subtitle="Escolha um resultado para testar. Atualizar a rota descartará todas as alterações."
        title={statusStop ? `NF ${statusStop.invoiceNumber}` : 'Alterar status'}
        visible={Boolean(statusStop)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F6FA' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA' },
  content: { paddingBottom: 42, gap: 11 },
  listHeader: { gap: 11 },
  listFooter: { gap: 11 },
  header: { backgroundColor: '#F3F6FA', paddingHorizontal: 20, paddingTop: 11, paddingBottom: 10 },
  headerCompact: { paddingTop: 8, paddingBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#DEE4EB' },
  greeting: { color: '#142035', fontSize: 25, fontWeight: '900', letterSpacing: -0.7 },
  greetingCompact: { fontSize: 17, letterSpacing: -0.3 },
  greetingHint: { color: '#8490A0', fontSize: 10, marginTop: 4 },
  compactRoute: { color: '#607087', fontSize: 11, fontWeight: '700' },
  summaryCard: { marginHorizontal: 18, backgroundColor: '#FFFFFF', borderRadius: 17, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#E1E6EC', gap: 7 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  routeLine: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  routeTitle: { color: '#17243A', fontSize: 14, fontWeight: '900' },
  routeMeta: { flex: 1, color: '#6B7789', fontSize: 10, fontWeight: '700' },
  refreshMini: { minWidth: 58, height: 28, borderRadius: 9, backgroundColor: '#E9F1FC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  refreshMiniText: { color: '#1555A0', fontSize: 9, fontWeight: '900' },
  progressHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  progressPrimary: { color: '#17243A', fontSize: 12, fontWeight: '900' },
  progressMeta: { color: '#69778B', fontSize: 9, fontWeight: '700' },
  progressTrack: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: '#E4E9EF' },
  progressFill: { height: '100%', minWidth: 0, borderRadius: 4, backgroundColor: '#25A66A' },
  citiesText: { color: '#536279', fontSize: 9, fontWeight: '800' },
  trackingRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#E8ECF1', paddingTop: 9 },
  trackingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#AAB3BF' },
  trackingDotActive: { backgroundColor: '#20A464' },
  trackingCopy: { flex: 1 },
  trackingTitle: { color: '#24334A', fontSize: 10, fontWeight: '900' },
  trackingHint: { color: '#748196', fontSize: 9, marginTop: 1 },
  trackingButton: { minWidth: 61, height: 30, borderRadius: 9, backgroundColor: '#E9F1FC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  trackingButtonStop: { backgroundColor: '#FCECEC' },
  trackingButtonText: { color: '#1555A0', fontSize: 10, fontWeight: '900' },
  trackingLocked: { color: '#17643D', fontSize: 10, fontWeight: '900', backgroundColor: '#EAF8F0', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  trackingButtonStopText: { color: '#9B2C2C' },
  trackingError: { color: '#9B2C2C', fontSize: 9, lineHeight: 13, fontWeight: '700' },
  pendingReceiptButton: { minHeight: 42, borderRadius: 13, backgroundColor: '#EAF8F0', borderWidth: 1, borderColor: '#A7DFC0', alignItems: 'center', justifyContent: 'center' },
  pendingReceiptButtonText: { color: '#17643D', fontSize: 12, fontWeight: '900' },
  section: { marginHorizontal: 18, gap: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: '#17243A', fontSize: 18, fontWeight: '900' },
  sectionSubtitle: { color: '#7C899A', fontSize: 10, marginTop: 2 },
  draggableGroup: { gap: 9, paddingVertical: 3, marginHorizontal: 18 },
  draggingGroup: { opacity: 0.96, zIndex: 10 },
  dragPositionBadge: { alignSelf: 'center', zIndex: 30, elevation: 14, minWidth: 166, height: 34, borderRadius: 17, paddingHorizontal: 16, backgroundColor: '#0B1830', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 7, shadowOffset: { width: 0, height: 4 } },
  dragPositionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  dragLabelRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  dragLabelRowActive: { justifyContent: 'center' },
  dragLabel: { color: '#7C899A', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  dragLabelCurrent: { color: '#1268E8' },
  dragHandle: { color: '#7A8798', fontSize: 9, fontWeight: '800' },
  countBadge: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: '#E4EAF1', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#49596F', fontSize: 11, fontWeight: '900' },
  emptyCard: { marginHorizontal: 18, backgroundColor: '#FFFFFF', borderRadius: 21, padding: 24, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#E1E6EC' },
  emptyTitle: { color: '#17243A', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: '#6B7789', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyAction: { backgroundColor: '#1268E8', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13, marginTop: 5 },
  emptyActionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  offlineBox: { marginHorizontal: 18, backgroundColor: '#FFF0F0', borderRadius: 13, padding: 12 },
  offlineText: { color: '#933131', fontSize: 11, lineHeight: 17 },
  operationBox: { marginHorizontal: 18, backgroundColor: '#FFF0F0', borderRadius: 13, padding: 12 },
  operationText: { color: '#933131', fontSize: 11, lineHeight: 17, fontWeight: '700' },
  footerActions: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  footerButton: { minWidth: 105, height: 44, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9E0E8', alignItems: 'center', justifyContent: 'center' },
  footerButtonText: { color: '#40516A', fontWeight: '800', fontSize: 12 },
  logoutText: { color: '#A42323', fontWeight: '800', fontSize: 12 },
});
