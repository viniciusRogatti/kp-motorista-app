import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Share from 'react-native-share';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { ActionButton } from '@/components/ActionButton';
import { readCachedAssignedTrip } from '@/database/tripRepository';
import {
  createDriverOccurrence,
  markDriverOccurrenceShared,
  type DriverOccurrenceItem,
  type DriverOccurrenceType,
} from '@/services/driverOccurrences';
import type { AssignedTrip } from '@/types/trip';

type Stop = AssignedTrip['stops'][number];
type ReturnScope = 'total' | 'partial';
type Photo = Pick<CameraCapturedPicture, 'uri'> & { mimeType?: string; fileName?: string };

const OCCURRENCE_LABELS: Record<DriverOccurrenceType, string> = {
  redelivery: 'Reentrega',
  return: 'Devolução',
  missing_product: 'Produto faltante',
  cancellation: 'Cancelamento / refaturamento',
};
const REDELIVERY_REASONS = [
  'CLIENTE FECHADO',
  'NÃO HOUVE TEMPO PARA IR AO LOCAL',
  'LOCAL FECHOU ANTES DA CONCLUSÃO',
];
const validTypes = new Set<DriverOccurrenceType>(['redelivery', 'return', 'missing_product', 'cancellation']);
const normalizeUpper = (value: string) => value.trim().toLocaleUpperCase('pt-BR');

export default function OccurrenceScreen() {
  const { session, isLoading } = useAuth();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ stopId?: string; occurrenceType?: string }>();
  const stopId = Number(params.stopId || 0);
  const occurrenceType = validTypes.has(params.occurrenceType as DriverOccurrenceType)
    ? params.occurrenceType as DriverOccurrenceType
    : null;
  const [stop, setStop] = useState<Stop | null>(null);
  const [loadingStop, setLoadingStop] = useState(true);
  const [returnScope, setReturnScope] = useState<ReturnScope>('total');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const clientEventId = useMemo(() => Crypto.randomUUID(), []);

  useEffect(() => {
    let active = true;
    void readCachedAssignedTrip(db).then((trip) => {
      if (!active) return;
      setStop(trip?.stops.find((candidate) => candidate.id === stopId) ?? null);
      setLoadingStop(false);
    });
    return () => { active = false; };
  }, [db, stopId]);

  if (isLoading || loadingStop) return <View style={styles.center}><ActivityIndicator color="#1268E8" size="large" /></View>;
  if (!session) return <Redirect href="/" />;
  if (!stop || !occurrenceType) {
    return <SafeAreaView style={styles.center}><Text style={styles.errorText}>Entrega ou tipo de ocorrência inválido.</Text></SafeAreaView>;
  }
  const currentSession = session;
  const currentStop = stop;
  const currentOccurrenceType = occurrenceType;

  const needsItems = occurrenceType === 'missing_product' || (occurrenceType === 'return' && returnScope === 'partial');
  const evidenceRequired = occurrenceType === 'return'
    || occurrenceType === 'missing_product'
    || (occurrenceType === 'redelivery' && ['CLIENTE FECHADO', 'LOCAL FECHOU ANTES DA CONCLUSÃO'].includes(normalizeUpper(reason)));
  const selectedItems: DriverOccurrenceItem[] = currentStop.products.flatMap((product) => {
    const quantity = Number(String(quantities[product.code] ?? '').replace(',', '.'));
    return Number.isFinite(quantity) && quantity > 0 ? [{ productCode: product.code, quantity }] : [];
  });

  function toggleProduct(code: string) {
    setQuantities((current) => current[code]
      ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== code))
      : { ...current, [code]: '1' });
  }

  async function openCamera() {
    setError('');
    let granted = cameraPermission?.granted;
    if (!granted) granted = (await requestCameraPermission()).granted;
    if (!granted) {
      Alert.alert('Câmera necessária', 'Autorize a câmera para fotografar o comprovante desta ocorrência.');
      return;
    }
    setCameraOpen(true);
  }

  async function takePhoto() {
    if (!cameraRef.current || takingPhoto) return;
    setTakingPhoto(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.82, skipProcessing: false });
      if (picture?.uri) {
        setPhoto({ uri: picture.uri, mimeType: 'image/jpeg', fileName: `ocorrencia-nf-${currentStop.invoiceNumber}.jpg` });
        setCameraOpen(false);
      }
    } catch {
      Alert.alert('Falha na câmera', 'Não foi possível tirar a foto. Tente novamente.');
    } finally {
      setTakingPhoto(false);
    }
  }

  function validate() {
    if (!reason.trim()) return 'Informe o motivo da ocorrência.';
    if (needsItems && !selectedItems.length) return 'Selecione ao menos um produto e informe a quantidade.';
    for (const selected of selectedItems) {
      const product = currentStop.products.find((item) => item.code === selected.productCode);
      if (!product || selected.quantity > product.quantity) return `Revise a quantidade do produto ${selected.productCode}.`;
    }
    if (evidenceRequired && !photo) return 'Tire a foto de comprovação antes de continuar.';
    return '';
  }

  async function submit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await createDriverOccurrence(currentSession.token, currentStop.id, {
        occurrenceType: currentOccurrenceType,
        returnScope: currentOccurrenceType === 'return' ? returnScope : null,
        reason,
        description,
        items: needsItems ? selectedItems : [],
        clientEventId,
        evidence: photo,
      });
      const shareResult = await Share.open({
        title: `Enviar para ${response.occurrence.whatsappGroupName}`,
        message: response.occurrence.shareMessage,
        ...(photo ? { url: photo.uri, type: photo.mimeType || 'image/jpeg', filename: photo.fileName } : {}),
        failOnCancel: false,
        useInternalStorage: true,
      });
      if (shareResult.dismissedAction) {
        setError(`A ocorrência foi salva. Abra novamente para enviar a mensagem ao grupo ${response.occurrence.whatsappGroupName}.`);
        return;
      }
      await markDriverOccurrenceShared(currentSession.token, response.occurrence.id).catch(() => undefined);
      Alert.alert('Ocorrência registrada', `Escolha o grupo ${response.occurrence.whatsappGroupName} no WhatsApp e confirme o envio.`, [
        { text: 'Concluir', onPress: () => router.back() },
      ]);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Não foi possível registrar a ocorrência.';
      setError(message);
      if (message.toLowerCase().includes('share') || message.toLowerCase().includes('compart')) {
        await Clipboard.setStringAsync(`NF ${currentStop.invoiceNumber} — ${reason}`).catch(() => undefined);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (cameraOpen) {
    return (
      <View style={styles.cameraScreen}>
        <CameraView ref={cameraRef} facing="back" style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.cameraOverlay}>
          <Pressable onPress={() => setCameraOpen(false)} style={styles.cameraClose}><Text style={styles.cameraCloseText}>Cancelar</Text></Pressable>
          <View style={styles.cameraHint}><Text style={styles.cameraHintText}>Enquadre o comprovante inteiro e evite reflexos.</Text></View>
          <Pressable disabled={takingPhoto} onPress={() => void takePhoto()} style={styles.shutter}>
            {takingPhoto ? <ActivityIndicator color="#0B1830" /> : <View style={styles.shutterInner} />}
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>{OCCURRENCE_LABELS[occurrenceType].toLocaleUpperCase('pt-BR')}</Text>
            <Text style={styles.title}>NF {stop.invoiceNumber}</Text>
            <Text style={styles.customer}>{stop.customerName}</Text>
          </View>

          {occurrenceType === 'return' ? (
            <View style={styles.section}>
              <Text style={styles.label}>Tipo da devolução</Text>
              <View style={styles.row}>
                {(['total', 'partial'] as const).map((scope) => (
                  <Pressable key={scope} onPress={() => setReturnScope(scope)} style={[styles.choice, returnScope === scope && styles.choiceActive]}>
                    <Text style={[styles.choiceText, returnScope === scope && styles.choiceTextActive]}>{scope === 'total' ? 'Total' : 'Parcial'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.label}>Motivo</Text>
            {occurrenceType === 'redelivery' ? (
              <View style={styles.chips}>{REDELIVERY_REASONS.map((item) => (
                <Pressable key={item} onPress={() => setReason(item)} style={[styles.chip, normalizeUpper(reason) === item && styles.chipActive]}>
                  <Text style={[styles.chipText, normalizeUpper(reason) === item && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              ))}</View>
            ) : null}
            <TextInput
              maxLength={180}
              onChangeText={setReason}
              placeholder={occurrenceType === 'redelivery' ? 'Ou descreva outro motivo' : 'Digite o motivo'}
              placeholderTextColor="#929CAA"
              style={styles.input}
              value={reason}
            />
          </View>

          {needsItems ? (
            <View style={styles.section}>
              <Text style={styles.label}>Produtos e quantidades</Text>
              {!stop.products.length ? <Text style={styles.warning}>A lista de produtos desta NF não está disponível. Atualize a rota e tente novamente.</Text> : null}
              {stop.products.map((product) => {
                const selected = quantities[product.code] !== undefined;
                return (
                  <View key={product.code} style={[styles.product, selected && styles.productSelected]}>
                    <Pressable onPress={() => toggleProduct(product.code)} style={styles.productMain}>
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Text style={styles.check}>✓</Text> : null}</View>
                      <View style={styles.productText}>
                        <Text style={styles.productCode}>{product.code}</Text>
                        <Text style={styles.productDescription}>{product.description}</Text>
                        <Text style={styles.productLimit}>NF: {product.quantity} {product.type || 'UN'}</Text>
                      </View>
                    </Pressable>
                    {selected ? <TextInput
                      keyboardType="decimal-pad"
                      onChangeText={(value) => setQuantities((current) => ({ ...current, [product.code]: value }))}
                      selectTextOnFocus
                      style={styles.quantity}
                      value={quantities[product.code]}
                    /> : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.label}>Descrição adicional (opcional)</Text>
            <TextInput
              maxLength={2000}
              multiline
              onChangeText={setDescription}
              placeholder="Detalhes úteis para a equipe"
              placeholderTextColor="#929CAA"
              style={[styles.input, styles.multiline]}
              textAlignVertical="top"
              value={description}
            />
          </View>

          {occurrenceType !== 'cancellation' ? (
            <View style={styles.section}>
              <Text style={styles.label}>Foto de comprovação {evidenceRequired ? '*' : '(opcional)'}</Text>
              {photo ? <Image source={{ uri: photo.uri }} style={styles.preview} /> : <View style={styles.photoEmpty}><Text style={styles.photoEmptyText}>Nenhuma foto tirada</Text></View>}
              <ActionButton onPress={openCamera} variant="secondary">{photo ? 'Tirar outra foto' : 'Abrir câmera'}</ActionButton>
            </View>
          ) : null}

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
          <ActionButton disabled={needsItems && !stop.products.length} loading={submitting} onPress={submit}>
            Salvar e abrir WhatsApp
          </ActionButton>
          <Text style={styles.shareHint}>No WhatsApp, escolha manualmente o grupo KP Acertos e toque em enviar.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F3F6FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F3F6FA' },
  content: { padding: 18, paddingBottom: 44, gap: 14 },
  heading: { backgroundColor: '#0B1830', borderRadius: 20, padding: 18 },
  eyebrow: { color: '#8FC1FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 5 },
  customer: { color: '#D8E6F8', fontSize: 14, fontWeight: '700', marginTop: 3 },
  section: { backgroundColor: '#FFFFFF', borderColor: '#DCE3EB', borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  label: { color: '#24344B', fontSize: 13, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 9 },
  choice: { flex: 1, minHeight: 45, borderRadius: 13, backgroundColor: '#F0F3F7', alignItems: 'center', justifyContent: 'center' },
  choiceActive: { backgroundColor: '#1268E8' },
  choiceText: { color: '#55647A', fontWeight: '800' },
  choiceTextActive: { color: '#FFFFFF' },
  chips: { gap: 7 },
  chip: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#D5DDE7', justifyContent: 'center', paddingHorizontal: 12 },
  chipActive: { borderColor: '#1268E8', backgroundColor: '#EAF2FF' },
  chipText: { color: '#4C5C72', fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: '#0B55BD' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#D3DBE5', borderRadius: 13, color: '#17243A', paddingHorizontal: 13, fontSize: 14, backgroundColor: '#FAFBFC' },
  multiline: { minHeight: 92, paddingTop: 12 },
  product: { borderWidth: 1, borderColor: '#E0E5EB', borderRadius: 14, padding: 11, gap: 9 },
  productSelected: { borderColor: '#77A9EB', backgroundColor: '#F5F9FF' },
  productMain: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1, borderColor: '#AEB8C6', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#1268E8', borderColor: '#1268E8' },
  check: { color: '#FFFFFF', fontWeight: '900' },
  productText: { flex: 1 },
  productCode: { color: '#1763BE', fontSize: 11, fontWeight: '900' },
  productDescription: { color: '#26364C', fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 2 },
  productLimit: { color: '#778497', fontSize: 10, marginTop: 4 },
  quantity: { alignSelf: 'flex-end', width: 94, height: 43, borderRadius: 11, borderWidth: 1, borderColor: '#AAC5E9', backgroundColor: '#FFFFFF', textAlign: 'center', color: '#173B67', fontWeight: '900' },
  warning: { color: '#8A5B12', backgroundColor: '#FFF7DF', padding: 11, borderRadius: 11, fontSize: 12, lineHeight: 17 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: '#DDE3EA' },
  photoEmpty: { height: 120, borderRadius: 14, backgroundColor: '#EEF2F6', alignItems: 'center', justifyContent: 'center' },
  photoEmptyText: { color: '#7A8798', fontSize: 12, fontWeight: '700' },
  errorBox: { backgroundColor: '#FFF0F0', borderColor: '#F0C5C5', borderWidth: 1, borderRadius: 14, padding: 13 },
  errorText: { color: '#963535', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  shareHint: { color: '#6B788A', fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 15 },
  cameraScreen: { flex: 1, backgroundColor: '#000000' },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 },
  cameraClose: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10 },
  cameraCloseText: { color: '#FFFFFF', fontWeight: '900' },
  cameraHint: { backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 13, paddingHorizontal: 15, paddingVertical: 10 },
  cameraHintText: { color: '#FFFFFF', fontSize: 12, textAlign: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: 'rgba(255,255,255,0.45)' },
  shutterInner: { width: 59, height: 59, borderRadius: 30, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#0B1830' },
});
