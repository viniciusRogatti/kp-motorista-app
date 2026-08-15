import { useMemo, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AssignedTrip } from '@/types/trip';

import { getCompanyTheme } from './companyTheme';

type Stop = AssignedTrip['stops'][number];

const labels: Record<string, string> = {
  pending: 'Pendente', assigned: 'Atribuída', on_the_way: 'A caminho', arrived: 'No local',
  delivered: 'Entregue', returned: 'Devolvida', cancelled: 'Cancelada', completed: 'Concluída',
  redelivery: 'Reentrega', retained: 'Retida',
};

export function DeliveryCard({
  stop,
  prominent = false,
  onDetails,
  onLongPress,
  longPressHint,
  primaryAction,
}: {
  stop: Stop;
  prominent?: boolean;
  onDetails: () => void;
  onLongPress?: () => void;
  longPressHint?: string;
  primaryAction?: { label: string; loading?: boolean; disabled?: boolean; onPress: () => void };
}) {
  const [translateX, setTranslateX] = useState(0);
  const theme = getCompanyTheme(stop.companyCode);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dx < -8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => setTranslateX(Math.max(-80, Math.min(0, gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx < -55) onDetails();
      setTranslateX(0);
    },
    onPanResponderTerminate: () => setTranslateX(0),
  }), [onDetails]);

  return (
    <View style={styles.swipeFrame}>
      <View style={styles.reveal}><Text style={styles.revealText}>Detalhes</Text><Text style={styles.revealArrow}>←</Text></View>
      <View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          accessibilityHint="Arraste para a esquerda para ver os detalhes"
          accessibilityRole="button"
          delayLongPress={350}
          onLongPress={onLongPress}
          onPress={onDetails}
          style={[
            styles.card,
            { backgroundColor: theme.background, borderColor: theme.border },
            prominent && styles.prominent,
          ]}
        >
          <View style={styles.topRow}>
            <View style={[styles.sequence, { backgroundColor: theme.accent }]}><Text style={styles.sequenceText}>{stop.sequence}</Text></View>
            <View style={styles.companyPill}><Text style={[styles.companyText, { color: theme.accent }]}>{theme.label}</Text></View>
            <Text style={[styles.status, { color: theme.accent }]}>{labels[stop.status] || stop.status}</Text>
          </View>
          <Text numberOfLines={2} style={styles.customer}>{stop.customerName || `NF ${stop.invoiceNumber}`}</Text>
          <Text style={styles.location}>{stop.city || 'Cidade não informada'} • NF {stop.invoiceNumber}</Text>
          <Text style={styles.hint}>{onLongPress ? `${longPressHint || 'Segure para opções'}  ·  ` : ''}← detalhes</Text>
        </Pressable>
        {primaryAction ? (
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeFrame: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#173B67' },
  reveal: { position: 'absolute', inset: 0, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 18 },
  revealText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  revealArrow: { color: '#AFC9E9', fontSize: 18, marginTop: 2 },
  card: { borderWidth: 1, borderRadius: 18, padding: 15, minHeight: 118 },
  prominent: { minHeight: 142, borderWidth: 2, shadowColor: '#0B1830', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sequence: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sequenceText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  companyPill: { flex: 1 },
  companyText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  status: { fontSize: 10, fontWeight: '900' },
  customer: { color: '#1C293B', fontSize: 16, fontWeight: '900', lineHeight: 21, marginTop: 11 },
  location: { color: '#59677A', fontSize: 12, marginTop: 5 },
  hint: { color: '#7A8798', fontSize: 9, fontWeight: '700', textAlign: 'right', marginTop: 10 },
  primaryAction: { marginTop: -1, minHeight: 43, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  actionDisabled: { opacity: 0.65 },
});
