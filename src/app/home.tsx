import * as Crypto from 'expo-crypto';
import { Redirect, Link, useFocusEffect, useRouter } from 'expo-router';
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
import {
  acceptAssignedTrip,
  getAssignedTrip,
  reorderTripStops,
  selectNextTripStop,
  updateTripStopStatus,
  type DriverStopStatus,
} from '@/services/trips';
import { startTripTracking } from '@/tasks/backgroundLocation';
import { scheduleRouteEndReminder } from '@/services/mobileNotifications';
import type { AssignedTrip } from '@/types/trip';

type Stop = AssignedTrip['stops'][number];
type StopGroup = { key: string; stops: Stop[] };
type LoadState = 'loading' | 'ready' | 'refreshing' | 'offline';

const finalStatuses = new Set(['delivered', 'returned', 'cancelled', 'completed', 'redelivery', 'retained']);
const completedDeliveryStatuses = new Set(['delivered', 'completed']);
const operationalFinalStatuses = new Set([...finalStatuses, 'delivered_pending_receipt']);
const isActiveStopStatus = (status: string) => status === 'on_the_way' || status === 'arrived';

function clientKey(stop: Stop) {
  return stop.customerName.trim().toLocaleLowerCase('pt-BR') || stop.customerId || `stop-${stop.id}`;
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
  return index === 0 ? 'SOLTE NA ENTREGA ATIVA' : `POSIÇÃO ${index + 1}`;
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
  const router = useRouter();
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

  useEffect(() => {
    if (!trip?.tracking.acceptedAt || !sessionToken) return;
    void startTripTracking(trip.id, sessionToken, trip.tracking.stopAt)
      .catch((error) => setTrackingMessage(error instanceof Error ? error.message : 'Nao foi possivel iniciar o rastreamento.'));
  }, [sessionToken, trip?.id, trip?.tracking.acceptedAt, trip?.tracking.stopAt]);

  useEffect(() => { void scheduleRouteEndReminder(trip?.tracking.stopAt); }, [trip?.tracking.stopAt]);

  if (isLoading) return <View style={styles.loading}><ActivityIndicator color="#1268E8" size="large" /></View>;
  if (!session) return <Redirect href="/" />;

  const displayName = session.user.name?.trim() || session.user.username;
  const openStops = trip?.stops.filter((stop) => !operationalFinalStatuses.has(stop.status)) ?? [];
  const pendingReceiptStops = trip?.stops.filter((stop) => stop.status === 'delivered_pending_receipt') ?? [];
  const finishedStops = trip?.stops.filter((stop) => finalStatuses.has(stop.status)) ?? [];
  const completedDeliveryStops = finishedStops.filter((stop) => completedDeliveryStatuses.has(stop.status));
  const exceptionStops = finishedStops.filter((stop) => !completedDeliveryStatuses.has(stop.status));
  const currentStop = openStops.find((stop) => stop.status === 'arrived')
    || openStops.find((stop) => stop.status === 'on_the_way')
    || null;
  const currentStops = currentStop ? openStops.filter((stop) => clientKey(stop) === clientKey(currentStop)) : [];
  const currentIds = new Set(currentStops.map((stop) => stop.id));
  const nextStops = openStops.filter((stop) => !currentIds.has(stop.id));
  const draggableGroups = trip?.tracking.acceptedAt || simulationEnabled ? groupStopsByClient(nextStops) : [];
  async function acceptRoute() {
    if (!trip || !sessionToken || acceptingRoute) return;
    setAcceptingRoute(true);
    setTrackingMessage('');
    try {
      await acceptAssignedTrip(sessionToken, trip.id, Crypto.randomUUID());
      await refreshTrip(false);
      try {
        await startTripTracking(trip.id, sessionToken, trip.tracking.stopAt);
      } catch (error) {
        setTrackingMessage(error instanceof Error ? error.message : 'Nao foi possivel iniciar o rastreamento.');
      }
    } catch (error) {
      setTrackingMessage(error instanceof Error ? error.message : 'Nao foi possivel aceitar a rota.');
    } finally {
      setAcceptingRoute(false);
    }
  }

  async function changeStopStatus(stop: Stop, status: DriverStopStatus) {
    if (simulationEnabled) {
      setTrip((current) => current ? updateSimulatedStatus(current, stop.id, status) : current);
      return true;
    }
    if (!operationsEnabled || !sessionToken || activeOperation) return false;
    setActiveOperation(`status-${stop.id}`);
    setOperationMessage('');
    try {
      await updateTripStopStatus(sessionToken, stop.id, status, Crypto.randomUUID());
      await refreshTrip(false);
      return true;
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a parada.');
      return false;
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
        label: 'Registrar resultado',
        disabled: !operationsEnabled || !trip?.tracking.acceptedAt,
        loading: activeOperation === `status-${stop.id}` || activeOperation === `cancel-${stop.id}`,
        onPress: () => setStatusStop(stop),
      };
    }
    return undefined;
  }

  function applySimulatedStatus(status: SimulatedStatus) {
    if (!statusStop) return;
    setTrip((current) => current ? updateSimulatedStatus(current, statusStop.id, status) : current);
    setStatusStop(null);
  }

  function finishSimulatedDrag(groups: StopGroup[], activateFirst = false) {
    const queuedIds = groups.flatMap((group) => group.stops.map((stop) => stop.id));
    const selectedIds = activateFirst && groups[0] ? new Set(groups[0].stops.map((stop) => stop.id)) : new Set<number>();
    const orderedStopIds = activateFirst
      ? [...(groups[0]?.stops.map((stop) => stop.id) ?? []), ...currentStops.filter((stop) => !selectedIds.has(stop.id)).map((stop) => stop.id), ...queuedIds.filter((id) => !selectedIds.has(id))]
      : [...currentStops.map((stop) => stop.id), ...queuedIds];
    setTrip((current) => current ? reorderSimulatedClients(current, orderedStopIds, activateFirst) : current);
  }

  async function finishLiveDrag(groups: StopGroup[], activateFirst = false) {
    if (!sessionToken || !trip || !groups.length || activeOperation) return;
    if (!operationsEnabled || !trip.tracking.acceptedAt) {
      Alert.alert('Aceite a rota', 'Confirme o aceite da rota antes de reorganizar as entregas.');
      return;
    }
    const queuedIds = groups.flatMap((group) => group.stops.map((stop) => stop.id));
    const selectedIds = activateFirst && groups[0] ? new Set(groups[0].stops.map((stop) => stop.id)) : new Set<number>();
    const currentAfterSelection = activateFirst ? currentStops.filter((stop) => !selectedIds.has(stop.id)) : currentStops;
    const orderedOpenIds = activateFirst
      ? [...(groups[0]?.stops.map((stop) => stop.id) ?? []), ...currentAfterSelection.map((stop) => stop.id), ...queuedIds.filter((id) => !selectedIds.has(id))]
      : [...currentStops.map((stop) => stop.id), ...queuedIds];
    const openIdSet = new Set(orderedOpenIds);
    const orderedStopIds = [...orderedOpenIds, ...trip.stops.filter((stop) => !openIdSet.has(stop.id)).map((stop) => stop.id)];
    const firstStop = groups[0].stops[0];
    const firstClientChanged = activateFirst && (!currentStop || clientKey(firstStop) !== clientKey(currentStop));

    setActiveOperation(`reorder-${firstStop.id}`);
    setOperationMessage('');
    try {
      if (firstClientChanged) {
        await selectNextTripStop(sessionToken, firstStop.id, orderedStopIds, Crypto.randomUUID());
      } else {
        await reorderTripStops(sessionToken, trip.id, orderedStopIds, Crypto.randomUUID());
      }
      await refreshTrip(false);
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : 'Não foi possível salvar a nova ordem.');
      await refreshTrip(false);
    } finally {
      setActiveOperation(null);
    }
  }

  function finishDrag(groups: StopGroup[], activateFirst = false) {
    if (simulationEnabled) {
      finishSimulatedDrag(groups, activateFirst);
      return;
    }
    void finishLiveDrag(groups, activateFirst);
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
      await selectNextTripStop(sessionToken, stop.id, orderedStops.map((item) => item.id), Crypto.randomUUID());
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
    Alert.alert(
      currentStop && clientKey(currentStop) !== clientKey(stop) ? 'Trocar a entrega atual?' : 'Tornar a próxima parada?',
      `${stop.customerName || `NF ${stop.invoiceNumber}`} será movida para o topo e marcada como “A caminho”.${currentStop && clientKey(currentStop) !== clientKey(stop) ? ' A entrega atual voltará para “Atribuída”.' : ''} As outras NFs do mesmo cliente irão junto.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => void promoteStop(stop) },
      ],
    );
  }

  function advanceStop(stop: Stop) {
    if (stop.status === 'pending' || stop.status === 'assigned') {
      confirmPromotion(stop);
    } else if (stop.status === 'on_the_way') {
      void changeStopStatus(stop, 'arrived');
    } else if (stop.status === 'arrived') {
      void completeDelivery(stop);
    }
  }

  async function completeDelivery(stop: Stop) {
    const updated = await changeStopStatus(stop, 'delivered_pending_receipt');
    if (!updated || simulationEnabled) return;
    router.push({
      pathname: '/receipt-capture',
      params: {
        invoiceNumber: stop.invoiceNumber,
        customerName: stop.customerName,
        groupName: stop.receiptGroupName || 'Grupo de canhotos',
        autoOpen: '1',
      },
    } as never);
  }

  async function applyLiveResult(status: DriverStopStatus) {
    if (!statusStop || !sessionToken || activeOperation) return;
    const stop = statusStop;
    setStatusStop(null);
    if (status === 'delivered_pending_receipt') {
      await completeDelivery(stop);
      return;
    }
    await changeStopStatus(stop, status);
  }

  function openOccurrence(occurrenceType: 'redelivery' | 'return' | 'retained_receipt' | 'missing_product' | 'cancellation') {
    if (!statusStop) return;
    const stopId = statusStop.id;
    setStatusStop(null);
    router.push({ pathname: '/occurrence', params: { stopId: String(stopId), occurrenceType } } as never);
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
      {!headerCompact ? <Text style={styles.greetingHint}>Toque ou role para recolher</Text> : null}
    </Pressable>
  );

  const summaryContent = trip && !simulationEnabled && !trip.tracking.acceptedAt ? (
    <View style={styles.acceptanceCard}>
      <Text style={styles.acceptanceTitle}>Sua viagem está pronta</Text>
      <Text style={styles.acceptanceText}>Confirme o aceite para liberar as entregas e iniciar o acompanhamento pelo GPS.</Text>
      <Pressable disabled={acceptingRoute} onPress={() => void acceptRoute()} style={styles.acceptRouteButton}>
        {acceptingRoute ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.acceptRouteButtonText}>ACEITAR VIAGEM</Text>}
      </Pressable>
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
                <Text style={styles.dragLabel}>PARADA {groupIndex + 1}</Text>
                <Text style={styles.dragHandle}>≡</Text>
              </>
            )}
          </View>
          {item.stops.map((stop, index) => (
            <DeliveryCard
              compact={index > 0}
              key={stop.id}
              stop={stop}
              prominent={false}
              onDetails={() => setDetailsStop(stop)}
              onLongPress={drag}
              longPressHint={undefined}
            />
          ))}
        </View>
      </ScaleDecorator>
    );
  }

  const activeDeliveryContent = trip?.tracking.acceptedAt || simulationEnabled ? (
    <View style={styles.activeZone}>
      <View style={styles.activeZoneHeader}>
        <Text style={styles.activeZoneTitle}>ENTREGA ATIVA</Text>
        {currentStops.length ? <Text style={styles.activeZoneStatus}>{currentStop?.status === 'arrived' ? 'NO LOCAL' : 'A CAMINHO'}</Text> : null}
      </View>
      {currentStops.length ? currentStops.map((stop, index) => (
        <DeliveryCard
          key={stop.id}
          stop={stop}
          compact={index > 0}
          prominent={index === 0}
          onDetails={() => setDetailsStop(stop)}
          onSwipeRight={() => advanceStop(stop)}
          primaryAction={isActiveStopStatus(stop.status) ? statusAction(stop) : undefined}
        />
      )) : (
        <View style={styles.activeZoneEmpty}>
          <Text style={styles.activeZoneEmptyIcon}>↓</Text>
          <Text style={styles.activeZoneEmptyText}>ARRASTE A PRÓXIMA ENTREGA</Text>
        </View>
      )}
    </View>
  ) : null;

  const exceptionContent = exceptionStops.length ? (
    <View style={styles.section}>
      <SectionTitle title="Ocorrências da viagem" count={exceptionStops.length} subtitle="Devoluções, reentregas, retidos e cancelamentos" />
      {exceptionStops.map((stop) => (
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
      <SectionTitle title="Entregues sem foto" count={pendingReceiptStops.length} subtitle="Poste no grupo indicado para finalizar" />
      {pendingReceiptStops.map((stop) => (
        <DeliveryCard
          key={stop.id}
          stop={stop}
          onDetails={() => setDetailsStop(stop)}
          primaryAction={{ label: 'Corrigir resultado da entrega', onPress: () => setStatusStop(stop) }}
        />
      ))}
      <Link href={{ pathname: '/pending-receipts', params: { tripId: String(trip?.id || '') } } as never} asChild>
        <Pressable style={styles.pendingReceiptButton}><Text style={styles.pendingReceiptButtonText}>Ver NFs e grupos de WhatsApp</Text></Pressable>
      </Link>
    </View>
  ) : null;

  const completedDeliveriesLink = completedDeliveryStops.length ? (
    <View style={styles.section}>
      <Link href={{ pathname: '/completed-deliveries', params: { tripId: String(trip?.id || '') } } as never} asChild>
        <Pressable style={styles.completedDeliveriesButton}>
          <View>
            <Text style={styles.completedDeliveriesTitle}>Entregas concluídas</Text>
            <Text style={styles.completedDeliveriesSubtitle}>Fotos já postadas • fora da fila principal</Text>
          </View>
          <View style={styles.completedDeliveriesCount}><Text style={styles.completedDeliveriesCountText}>{completedDeliveryStops.length}</Text></View>
        </Pressable>
      </Link>
    </View>
  ) : null;

  const footerContent = (
    <View style={styles.listFooter}>
      {pendingReceiptsContent}
      {exceptionContent}
      {completedDeliveriesLink}
      {message ? <View style={styles.offlineBox}><Text style={styles.offlineText}>{message} O último roteiro salvo continua visível.</Text></View> : null}
      {trackingMessage ? <View style={styles.operationBox}><Text style={styles.operationText}>{trackingMessage}</Text></View> : null}
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
      {trip ? (
        <DraggableFlatList
          activationDistance={8}
          animationConfig={{ damping: 22, stiffness: 210, mass: 0.55 }}
          autoscrollSpeed={140}
          autoscrollThreshold={190}
          contentContainerStyle={styles.content}
          data={draggableGroups}
          dragItemOverflow
          keyExtractor={(group) => group.key}
          ListHeaderComponent={<View style={styles.listHeader}>{headerContent}{summaryContent}{activeDeliveryContent}{trip.tracking.acceptedAt || simulationEnabled ? <View style={styles.section}><SectionTitle title="Próximas entregas" count={nextStops.length} /></View> : null}</View>}
          ListFooterComponent={footerContent}
          onDragBegin={setCurrentDragPosition}
          onDragEnd={({ data, to }) => finishDrag(data, to === 0)}
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
                    compact={index > 0}
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
            {exceptionContent}
            {completedDeliveriesLink}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma viagem disponível</Text>
            <Text style={styles.emptyText}>Assim que uma rota for criada para este motorista, ela aparecerá automaticamente aqui.</Text>
            <Pressable onPress={() => void refreshTrip(true)} style={styles.emptyAction}><Text style={styles.emptyActionText}>Atualizar agora</Text></Pressable>
          </View>
        )}

        {message ? <View style={styles.offlineBox}><Text style={styles.offlineText}>{message} O último roteiro salvo continua visível.</Text></View> : null}
        {trackingMessage ? <View style={styles.operationBox}><Text style={styles.operationText}>{trackingMessage}</Text></View> : null}
        {operationMessage ? <View style={styles.operationBox}><Text style={styles.operationText}>{operationMessage}</Text></View> : null}

        <View style={styles.footerActions}>
          {isNonProduction ? <Link href="/diagnostics" asChild><Pressable style={styles.footerButton}><Text style={styles.footerButtonText}>Diagnóstico</Text></Pressable></Link> : null}
          <Pressable disabled={isSigningOut} onPress={() => void logout()} style={styles.footerButton}>
            {isSigningOut ? <ActivityIndicator color="#A42323" /> : <Text style={styles.logoutText}>Sair</Text>}
          </Pressable>
        </View>
      </ScrollView>}
      <DeliveryDetailsModal
        onClose={() => setDetailsStop(null)}
        onOpenActions={!simulationEnabled && detailsStop && (
          (currentIds.has(detailsStop.id) && isActiveStopStatus(detailsStop.status))
          || detailsStop.status === 'delivered_pending_receipt'
        ) ? (stop) => setStatusStop(stop) : undefined}
        stop={detailsStop}
      />
      <ActionSheet
        actions={simulationEnabled ? [
          { label: 'Pendente', onPress: () => applySimulatedStatus('pending') },
          { label: 'Entregue', onPress: () => applySimulatedStatus('delivered') },
          { label: 'Devolvida', tone: 'danger' as const, onPress: () => applySimulatedStatus('returned') },
          { label: 'Reentrega', onPress: () => applySimulatedStatus('redelivery') },
          { label: 'Retida', onPress: () => applySimulatedStatus('retained') },
        ] : [
          ...(statusStop?.status === 'arrived' ? [{ label: 'Entregue — aguardando foto', onPress: () => void applyLiveResult('delivered_pending_receipt') }] : []),
          { label: 'Devolução', tone: 'danger' as const, onPress: () => openOccurrence('return') },
          { label: 'Canhoto retido', onPress: () => openOccurrence('retained_receipt') },
          { label: 'Produto faltante', onPress: () => openOccurrence('missing_product') },
          { label: 'Reentrega', onPress: () => openOccurrence('redelivery') },
          { label: 'Solicitar cancelamento/refaturamento', tone: 'danger' as const, onPress: () => openOccurrence('cancellation') },
        ]}
        onClose={() => setStatusStop(null)}
        subtitle={simulationEnabled
          ? 'Escolha um resultado para testar. Atualizar a rota descartará todas as alterações.'
          : statusStop?.status === 'delivered_pending_receipt'
            ? 'Corrija o resultado enquanto o canhoto ainda não foi registrado. Depois da foto, a alteração fica bloqueada.'
            : 'O app prepara a mensagem e a foto; no WhatsApp você escolhe o grupo e confirma o envio.'}
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
  acceptanceCard: { marginHorizontal: 18, backgroundColor: '#FFFFFF', borderRadius: 17, padding: 14, borderWidth: 1, borderColor: '#E1E6EC', gap: 8 },
  acceptanceTitle: { color: '#17243A', fontSize: 16, fontWeight: '900' },
  acceptanceText: { color: '#69778B', fontSize: 11, lineHeight: 16 },
  acceptRouteButton: { minHeight: 58, marginTop: 5, borderRadius: 15, backgroundColor: '#1268E8', alignItems: 'center', justifyContent: 'center', shadowColor: '#1268E8', shadowOpacity: 0.28, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  acceptRouteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.6 },
  pendingReceiptButton: { minHeight: 42, borderRadius: 13, backgroundColor: '#FFF0F0', borderWidth: 1, borderColor: '#E2A4A4', alignItems: 'center', justifyContent: 'center' },
  pendingReceiptButtonText: { color: '#A42323', fontSize: 12, fontWeight: '900' },
  completedDeliveriesButton: { minHeight: 66, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE3EB', paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  completedDeliveriesTitle: { color: '#24344B', fontSize: 14, fontWeight: '900' },
  completedDeliveriesSubtitle: { color: '#768397', fontSize: 10, marginTop: 3 },
  completedDeliveriesCount: { minWidth: 34, height: 34, borderRadius: 17, backgroundColor: '#EAF8F0', alignItems: 'center', justifyContent: 'center' },
  completedDeliveriesCountText: { color: '#17643D', fontSize: 12, fontWeight: '900' },
  section: { marginHorizontal: 18, gap: 10 },
  activeZone: { marginHorizontal: 18, gap: 9, padding: 12, borderRadius: 22, backgroundColor: '#DCEBFF', borderWidth: 2, borderColor: '#1268E8' },
  activeZoneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3 },
  activeZoneTitle: { color: '#0E4D9A', fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  activeZoneStatus: { color: '#FFFFFF', backgroundColor: '#1268E8', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '900' },
  activeZoneEmpty: { minHeight: 104, borderRadius: 17, borderWidth: 2, borderStyle: 'dashed', borderColor: '#78A9E8', backgroundColor: '#F5F9FF', alignItems: 'center', justifyContent: 'center', gap: 5 },
  activeZoneEmptyIcon: { color: '#1268E8', fontSize: 24, fontWeight: '900' },
  activeZoneEmptyText: { color: '#1555A0', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
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
