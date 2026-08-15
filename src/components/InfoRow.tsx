import { StyleSheet, Text, View } from 'react-native';

export function InfoRow({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'good' | 'warn' }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, tone === 'good' && styles.good, tone === 'warn' && styles.warn]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E7EBF1' },
  label: { color: '#5A6678', fontSize: 13, flex: 1 },
  value: { color: '#152033', fontSize: 13, fontWeight: '700', flex: 1.3, textAlign: 'right' },
  good: { color: '#087A4D' },
  warn: { color: '#A35B00' },
});
