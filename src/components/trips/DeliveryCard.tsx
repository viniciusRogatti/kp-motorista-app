import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import type { AssignedTrip } from '@/types/trip';

import { getCompanyTheme } from './companyTheme';

type Stop = AssignedTrip['stops'][number];

const labels: Record<string, string> = {
  pending: 'Pendente', assigned: 'Atribuída', on_the_way: 'A caminho', arrived: 'No local',
  delivered: 'Entregue', returned: 'Devolvida', cancelled: 'Cancelada', completed: 'Concluída',
  redelivery: 'Reentrega', retained: 'Retida',
  delivered_pending_receipt: 'Entregue • foto pendente',
};

export function DeliveryCard({
  stop,
  prominent = false,
  compact = false,
  onDetails,
  onSwipeRight,
  onLongPress,
  longPressHint,
  primaryAction,
}: {
  stop: Stop;
  prominent?: boolean;
  compact?: boolean;
  onDetails: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  longPressHint?: string;
  primaryAction?: { label: string; loading?: boolean; disabled?: boolean; onPress: () => void };
}) {
  const translateX = useSharedValue(0);
  const theme = getCompanyTheme(stop.companyCode);
  const isMissingPhoto = stop.status === 'delivered_pending_receipt';
  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      translateX.value = Math.max(-80, Math.min(onSwipeRight ? 80 : 0, event.translationX));
    })
    .onEnd((event) => {
      if (event.translationX < -55) runOnJS(onDetails)();
      if (event.translationX > 55 && onSwipeRight) runOnJS(onSwipeRight)();
    })
    .onFinalize(() => {
      translateX.value = withSpring(0, { damping: 20, stiffness: 240 });
    });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.swipeFrame}>
      <View style={styles.reveal}>
        {onSwipeRight ? <View style={styles.rightReveal}><Text style={styles.revealArrow}>→</Text><Text style={styles.revealText}>Avançar</Text></View> : null}
        <View style={styles.leftReveal}><Text style={styles.revealText}>Detalhes</Text><Text style={styles.revealArrow}>←</Text></View>
      </View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <Pressable
            accessibilityHint={onSwipeRight ? 'Arraste para a direita para avançar ou para a esquerda para ver detalhes' : 'Arraste para a esquerda para ver os detalhes'}
            accessibilityRole="button"
            delayLongPress={350}
            onLongPress={onLongPress}
            onPress={onDetails}
            style={[
              styles.card,
              compact && styles.compactCard,
              { backgroundColor: theme.background, borderColor: theme.border },
              isMissingPhoto && styles.pendingReceipt,
              prominent && styles.prominent,
            ]}
          >
            {isMissingPhoto && !compact ? (
              <View style={styles.missingPhotoBanner}>
                <Text style={styles.missingPhotoText}>SEM FOTO</Text>
              </View>
            ) : null}
            {compact ? (
              <>
                <Text style={[styles.compactInvoice, { color: theme.accent }]}>NF {stop.invoiceNumber}</Text>
                <Text numberOfLines={1} style={styles.compactCustomer}>{stop.customerName || 'Cliente não informado'}</Text>
              </>
            ) : (
              <>
                <View style={styles.topRow}>
                  <View style={[styles.sequence, { backgroundColor: theme.accent }]}><Text style={styles.sequenceText}>{stop.sequence}</Text></View>
                  <View style={styles.companyPill}><Text style={[styles.companyText, { color: theme.accent }]}>{theme.label}</Text></View>
                  <Text style={[styles.status, { color: theme.accent }]}>{labels[stop.status] || stop.status}</Text>
                </View>
                <Text numberOfLines={2} style={styles.customer}>{stop.customerName || `NF ${stop.invoiceNumber}`}</Text>
                <Text style={styles.location}>{stop.city || 'Cidade não informada'} • NF {stop.invoiceNumber}</Text>
                {longPressHint ? <Text style={styles.hint}>{longPressHint}</Text> : null}
              </>
            )}
          </Pressable>
          {primaryAction && !compact ? (
            <Pressable
              accessibilityRole="button"
              disabled={primaryAction.loading || primaryAction.disabled}
              onPress={primaryAction.onPress}
              style={[styles.primaryAction, { backgroundColor: theme.accent }, (primaryAction.loading || primaryAction.disabled) && styles.actionDisabled]}
            >
              {primaryAction.loading
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={styles.primaryActionText}>{primaryAction.label}</Text>}
            </Pressable>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeFrame: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#173B67' },
  reveal: { position: 'absolute', inset: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  rightReveal: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  leftReveal: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  revealText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  revealArrow: { color: '#AFC9E9', fontSize: 18, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 18, padding: 15, minHeight: 118 },
  compactCard: { minHeight: 68, paddingVertical: 11, justifyContent: 'center' },
  prominent: { minHeight: 142, borderWidth: 2, shadowColor: '#0B1830', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  pendingReceipt: { backgroundColor: '#FFF5F5', borderColor: '#DC5656', borderWidth: 2 },
  missingPhotoBanner: { alignSelf: 'flex-start', borderRadius: 8, backgroundColor: '#C62828', paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  missingPhotoText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sequence: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sequenceText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  companyPill: { flex: 1 },
  companyText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  status: { fontSize: 10, fontWeight: '900' },
  customer: { color: '#1C293B', fontSize: 16, fontWeight: '900', lineHeight: 21, marginTop: 11 },
  compactInvoice: { fontSize: 12, fontWeight: '900' },
  compactCustomer: { color: '#1C293B', fontSize: 14, fontWeight: '800', marginTop: 3 },
  location: { color: '#59677A', fontSize: 12, marginTop: 5 },
  hint: { color: '#7A8798', fontSize: 9, fontWeight: '700', textAlign: 'right', marginTop: 10 },
  primaryAction: { marginTop: -1, minHeight: 43, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  actionDisabled: { opacity: 0.65 },
});
