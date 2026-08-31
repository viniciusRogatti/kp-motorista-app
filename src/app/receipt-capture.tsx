import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Share from 'react-native-share';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { ActionButton } from '@/components/ActionButton';
import { buildReceiptShareMessage, normalizeInvoiceNumberForShare } from '@/utils/receiptShare';

export default function ReceiptCaptureScreen() {
  const { session, isLoading } = useAuth();
  const params = useLocalSearchParams<{ invoiceNumber?: string; customerName?: string; groupName?: string; autoOpen?: string }>();
  const invoiceNumber = normalizeInvoiceNumberForShare(String(params.invoiceNumber || ''));
  const customerName = String(params.customerName || '').trim();
  const groupName = String(params.groupName || 'Grupo de canhotos').trim();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const autoOpenAttempted = useRef(false);

  const openCamera = useCallback(async () => {
    let granted = permission?.granted;
    if (!granted) granted = (await requestPermission()).granted;
    if (!granted) {
      Alert.alert('Câmera necessária', 'Autorize a câmera para fotografar o canhoto.');
      return;
    }
    setCameraOpen(true);
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    if (params.autoOpen !== '1' || isLoading || !session || !invoiceNumber || autoOpenAttempted.current) return;
    autoOpenAttempted.current = true;
    void openCamera();
  }, [invoiceNumber, isLoading, openCamera, params.autoOpen, session]);

  if (isLoading) return <View style={styles.center}><ActivityIndicator color="#1268E8" /></View>;
  if (!session) return <Redirect href="/" />;
  if (!invoiceNumber) return <View style={styles.center}><Text style={styles.errorText}>NF não informada.</Text></View>;

  async function takePhoto() {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.88, skipProcessing: false });
      if (picture?.uri) {
        setPhotoUri(picture.uri);
        setCameraOpen(false);
        setError('');
      }
    } catch {
      Alert.alert('Falha na câmera', 'Não foi possível tirar a foto. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function shareReceipt() {
    if (!photoUri || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await Share.open({
        title: `Postar no grupo ${groupName}`,
        message: buildReceiptShareMessage(invoiceNumber),
        url: photoUri,
        type: 'image/jpeg',
        filename: `canhoto-nf-${invoiceNumber}.jpg`,
        failOnCancel: false,
        useInternalStorage: true,
      });
      if (result.dismissedAction) {
        setError(`Envio cancelado. Escolha o WhatsApp e depois o grupo ${groupName}.`);
        return;
      }
      Alert.alert('WhatsApp aberto', `Confirme se o grupo selecionado é ${groupName} e envie a foto com a legenda ${invoiceNumber}.`, [
        { text: 'Concluir', onPress: () => router.back() },
      ]);
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Não foi possível abrir o compartilhamento.');
    } finally {
      setBusy(false);
    }
  }

  if (cameraOpen) {
    return (
      <View style={styles.cameraScreen}>
        <CameraView ref={cameraRef} facing="back" style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.cameraOverlay}>
          <Pressable accessibilityLabel="Fechar câmera" onPress={() => setCameraOpen(false)} style={styles.cameraClose}><Text style={styles.cameraCloseText}>×</Text></Pressable>
          <View style={styles.cameraHint}><Text style={styles.cameraHintText}>Enquadre todo o canhoto e deixe a assinatura e a NF legíveis.</Text></View>
          <View style={styles.cameraActions}>
            <Pressable disabled={busy} onPress={() => void takePhoto()} style={styles.shutter}>
              {busy ? <ActivityIndicator color="#0B1830" /> : <View style={styles.shutterInner} />}
            </Pressable>
            <Pressable onPress={() => router.back()} style={styles.laterButton}><Text style={styles.laterButtonText}>Tirar foto depois</Text></Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>POSTAR NO GRUPO</Text>
          <Text style={styles.groupName}>{groupName}</Text>
          <Text style={styles.invoice}>NF {invoiceNumber}</Text>
          {customerName ? <Text style={styles.customer}>{customerName}</Text> : null}
        </View>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : (
          <View style={styles.emptyPhoto}><Text style={styles.emptyPhotoTitle}>Fotografe o canhoto</Text><Text style={styles.emptyPhotoText}>A legenda “{invoiceNumber}” será incluída automaticamente.</Text></View>
        )}
        <ActionButton onPress={() => void openCamera()} variant={photoUri ? 'secondary' : 'primary'}>{photoUri ? 'Tirar outra foto' : 'Abrir câmera'}</ActionButton>
        {photoUri ? <ActionButton loading={busy} onPress={shareReceipt}>Abrir WhatsApp</ActionButton> : null}
        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
        <Text style={styles.hint}>O Astro abre o compartilhamento com foto e legenda prontas. Você escolhe o WhatsApp e o grupo indicado acima.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F6FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA', padding: 24 },
  content: { flex: 1, padding: 18, gap: 13 },
  header: { backgroundColor: '#0B1830', borderRadius: 20, padding: 18 },
  eyebrow: { color: '#8FC1FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  groupName: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginTop: 5 },
  invoice: { color: '#8FDDB3', fontSize: 18, fontWeight: '900', marginTop: 13 },
  customer: { color: '#D6E2F2', fontSize: 13, fontWeight: '700', marginTop: 3 },
  preview: { width: '100%', flex: 1, minHeight: 250, borderRadius: 18, backgroundColor: '#DDE3EA' },
  emptyPhoto: { flex: 1, minHeight: 230, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFC9D6', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 25 },
  emptyPhotoTitle: { color: '#25344A', fontSize: 18, fontWeight: '900' },
  emptyPhotoText: { color: '#6D798A', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  hint: { color: '#6D798A', fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 12 },
  error: { backgroundColor: '#FFF0F0', borderRadius: 13, padding: 12 },
  errorText: { color: '#963535', fontSize: 12, lineHeight: 17, textAlign: 'center' },
  cameraScreen: { flex: 1, backgroundColor: '#000000' },
  cameraOverlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  cameraClose: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10 },
  cameraCloseText: { color: '#FFFFFF', fontWeight: '900', fontSize: 24, lineHeight: 24 },
  cameraHint: { backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 13, padding: 11 },
  cameraHintText: { color: '#FFFFFF', fontSize: 12, textAlign: 'center' },
  shutter: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 59, height: 59, borderRadius: 30, borderWidth: 2, borderColor: '#0B1830' },
  cameraActions: { alignItems: 'center', gap: 14 },
  laterButton: { minHeight: 42, minWidth: 180, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  laterButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
