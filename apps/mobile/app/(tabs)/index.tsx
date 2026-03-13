import { View, Text, StyleSheet } from 'react-native'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Velora</Text>
      <Text style={styles.subtitle}>Crash Intelligence Platform</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
})
