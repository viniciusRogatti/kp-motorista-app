import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Action = { label: string; tone?: 'default' | 'danger'; onPress: () => void };

export function ActionSheet({
  visible,
  title,
  subtitle,
  actions,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: Action[];
  onClose: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable key={action.label} onPress={action.onPress} style={styles.action}>
                <Text style={[styles.actionText, action.tone === 'danger' && styles.dangerText]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Cancelar</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7, 16, 31, 0.42)' },
  sheet: { backgroundColor: '#F4F6F9', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#C7CED8', alignSelf: 'center', marginBottom: 15 },
  title: { color: '#17243A', fontSize: 20, fontWeight: '900' },
  subtitle: { color: '#6D798A', fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 12 },
  actions: { overflow: 'hidden', borderRadius: 16, backgroundColor: '#FFFFFF' },
  action: { minHeight: 51, justifyContent: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E8ECF1' },
  actionText: { color: '#1F5EAA', fontSize: 14, fontWeight: '800' },
  dangerText: { color: '#A43434' },
  cancel: { minHeight: 49, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, marginTop: 10 },
  cancelText: { color: '#4A586B', fontSize: 14, fontWeight: '900' },
});
