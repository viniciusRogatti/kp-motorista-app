import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { ActionSheet } from '@/components/trips/ActionSheet';
import { getPendingReceipts, type PendingReceiptItem } from '@/services/trips';

export default function PendingReceiptsScreen() {
  const { session, isLoading } = useAuth();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const tripId = Number(params.tripId || 0) || null;
  const sessionToken = session?.token;
  const [items, setItems] = useState<PendingReceiptItem[]>([]);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<PendingReceiptItem | null>(null);

  const openOccurrence = (occurrenceType: 'redelivery' | 'return' | 'retained_receipt' | 'missing_product' | 'cancellation') => {
    if (!selectedItem) return;
    const stopId = selectedItem.stopId;
    setSelectedItem(null);
    router.push({ pathname: '/occurrence', params: { stopId: String(stopId), occurrenceType } } as never);
  };

  const load = useCallback(async () => {
    if (!sessionToken) return;
    setRefreshing(true);
    try {
      const response = await getPendingReceipts(sessionToken, tripId);
      setItems(response.items);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar as NFs.');
    } finally {
      setRefreshing(false);
    }
  }, [sessionToken, tripId]);

  useFocusEffect(useCallback(() => {
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, [load]));

  if (isLoading) return <View style={styles.center}><ActivityIndicator color="#1268E8" /></View>;
  if (!session) return <Redirect href="/" />;

  const groups = new Map<string, PendingReceiptItem[]>();
  items.forEach((item) => groups.set(item.receiptGroupName, [...(groups.get(item.receiptGroupName) ?? []), item]));

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
      >
        <View style={styles.intro}>
          <Text style={styles.title}>{items.length} {items.length === 1 ? 'entrega sem foto' : 'entregas sem fotos'}</Text>
          <Text style={styles.subtitle}>A entrega so sera finalizada quando a foto for reconhecida no grupo indicado.</Text>
        </View>
        {Array.from(groups.entries()).map(([groupName, groupItems]) => (
          <View key={groupName} style={styles.group}>
            <Text style={styles.groupEyebrow}>POSTAR NO GRUPO</Text>
            <Text style={styles.groupName}>{groupName}</Text>
            {groupItems.map((item) => (
              <View key={item.stopId} style={styles.card}>
                <Text style={styles.invoice}>NF {item.invoiceNumber}</Text>
                <Text style={styles.customer}>{item.customerName || 'Cliente nao informado'}</Text>
                <Text style={styles.company}>{item.companyName || item.companyCode || 'Empresa'}</Text>
                <Pressable
                  onPress={() => router.push({
                    pathname: '/receipt-capture',
                    params: {
                      invoiceNumber: item.invoiceNumber,
                      customerName: item.customerName,
                      groupName: item.receiptGroupName,
                    },
                  } as never)}
                  style={styles.photoButton}
                >
                  <Text style={styles.photoButtonText}>Fotografar e abrir WhatsApp</Text>
                </Pressable>
                <Pressable onPress={() => setSelectedItem(item)} style={styles.correctionButton}>
                  <Text style={styles.correctionButtonText}>Corrigir resultado da entrega</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
        {!refreshing && !items.length ? (
          <View style={styles.empty}><Text style={styles.emptyTitle}>Tudo certo</Text><Text style={styles.subtitle}>Nenhuma entrega esta aguardando foto.</Text></View>
        ) : null}
        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Tentar novamente</Text></Pressable></View> : null}
      </ScrollView>
      <ActionSheet
        actions={[
          { label: 'Devolução', tone: 'danger', onPress: () => openOccurrence('return') },
          { label: 'Canhoto retido', onPress: () => openOccurrence('retained_receipt') },
          { label: 'Produto faltante', onPress: () => openOccurrence('missing_product') },
          { label: 'Reentrega', onPress: () => openOccurrence('redelivery') },
          { label: 'Solicitar cancelamento/refaturamento', tone: 'danger', onPress: () => openOccurrence('cancellation') },
        ]}
        onClose={() => setSelectedItem(null)}
        subtitle="A correção fica disponível somente enquanto o canhoto ainda não foi registrado."
        title={selectedItem ? `NF ${selectedItem.invoiceNumber}` : 'Corrigir resultado'}
        visible={Boolean(selectedItem)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F6FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, gap: 14, paddingBottom: 40 },
  intro: { backgroundColor: '#EAF8F0', borderColor: '#A7DFC0', borderWidth: 1, borderRadius: 18, padding: 16 },
  title: { color: '#145C38', fontSize: 21, fontWeight: '900' },
  subtitle: { color: '#5B697B', fontSize: 12, lineHeight: 18, marginTop: 5 },
  group: { backgroundColor: '#FFFFFF', borderColor: '#DCE3EB', borderWidth: 1, borderRadius: 18, padding: 14, gap: 9 },
  groupEyebrow: { color: '#7B8798', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  groupName: { color: '#17243A', fontSize: 17, fontWeight: '900' },
  card: { borderTopColor: '#E7EBF0', borderTopWidth: 1, paddingTop: 10 },
  invoice: { color: '#17643D', fontSize: 15, fontWeight: '900' },
  customer: { color: '#25344A', fontSize: 13, fontWeight: '700', marginTop: 2 },
  company: { color: '#7B8798', fontSize: 10, marginTop: 2 },
  photoButton: { minHeight: 42, borderRadius: 12, backgroundColor: '#1268E8', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  photoButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  correctionButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#D39A3B', backgroundColor: '#FFF8E8', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  correctionButtonText: { color: '#8A5A0A', fontSize: 12, fontWeight: '900' },
  empty: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24 },
  emptyTitle: { color: '#17643D', fontSize: 20, fontWeight: '900' },
  error: { backgroundColor: '#FFF0F0', borderRadius: 14, padding: 14 },
  errorText: { color: '#933131', fontSize: 12 },
  retry: { color: '#1268E8', fontWeight: '900', marginTop: 8 },
});
