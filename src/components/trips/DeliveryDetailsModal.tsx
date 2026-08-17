import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AssignedTrip } from '@/types/trip';

import { getCompanyTheme } from './companyTheme';

type Stop = AssignedTrip['stops'][number];
const actionableStatuses = new Set(['pending', 'assigned', 'on_the_way', 'arrived']);

export function DeliveryDetailsModal({ stop, onClose, onOpenActions }: { stop: Stop | null; onClose: () => void; onOpenActions?: (stop: Stop) => void }) {
  if (!stop) return null;
  const theme = getCompanyTheme(stop.companyCode);
  const address = [stop.address, stop.addressNumber, stop.neighborhood].filter(Boolean).join(', ');

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View><Text style={[styles.company, { color: theme.accent }]}>{theme.label}</Text><Text style={styles.title}>{stop.customerName}</Text></View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}><Text style={styles.closeText}>Fechar</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.invoice, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={styles.invoiceLabel}>NOTA FISCAL</Text><Text style={styles.invoiceValue}>{stop.invoiceNumber}</Text>
          </View>
          <Info label="Endereço" value={address || 'Não informado'} />
          <Info label="Cidade / UF" value={[stop.city, stop.state].filter(Boolean).join(' / ') || 'Não informado'} />
          <Info label="CEP" value={stop.zipCode || 'Não informado'} />
          <Info label="Telefone" value={stop.phone || 'Não informado'} />
          <Info label="Representante" value={stop.representativeName || 'Não informado'} />
          <View style={styles.productsSection}>
            <Text style={styles.sectionTitle}>Produtos</Text>
            {stop.products.length ? stop.products.map((product, index) => (
              <View key={`${product.code}-${index}`} style={styles.productRow}>
                <View style={styles.quantity}><Text style={styles.quantityText}>{product.quantity}</Text></View>
                <View style={styles.productContent}><Text style={styles.productName}>{product.description}</Text><Text style={styles.productCode}>{product.code || 'Sem código'}</Text></View>
              </View>
            )) : <Text style={styles.empty}>Produtos não informados pelo backend.</Text>}
          </View>
          {onOpenActions && actionableStatuses.has(stop.status) ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onClose();
                onOpenActions(stop);
              }}
              style={styles.outcomeButton}
            >
              <Text style={styles.outcomeButtonText}>Registrar ocorrência ou resultado</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F9' },
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E9EF', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  company: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: '#17243A', fontSize: 22, fontWeight: '900', marginTop: 4, maxWidth: 260 },
  close: { paddingVertical: 7, paddingHorizontal: 11, backgroundColor: '#EEF2F7', borderRadius: 12 },
  closeText: { color: '#40516A', fontSize: 12, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  invoice: { borderWidth: 1, borderRadius: 18, padding: 16 },
  invoiceLabel: { color: '#738094', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  invoiceValue: { color: '#17243A', fontSize: 22, fontWeight: '900', marginTop: 4 },
  info: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#E5E9EF' },
  infoLabel: { color: '#7B8797', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  infoValue: { color: '#263449', fontSize: 14, fontWeight: '700', marginTop: 5, lineHeight: 20 },
  productsSection: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E9EF' },
  sectionTitle: { color: '#17243A', fontSize: 17, fontWeight: '900', marginBottom: 8 },
  productRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF1F4' },
  quantity: { minWidth: 42, height: 34, borderRadius: 10, backgroundColor: '#E8F0FC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  quantityText: { color: '#1555A0', fontWeight: '900', fontSize: 12 },
  productContent: { flex: 1 },
  productName: { color: '#273449', fontWeight: '800', fontSize: 13 },
  productCode: { color: '#8490A0', fontSize: 10, marginTop: 3 },
  empty: { color: '#738094', fontSize: 13, paddingVertical: 10 },
  outcomeButton: { minHeight: 50, borderRadius: 15, backgroundColor: '#173B67', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  outcomeButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', textAlign: 'center' },
});
