import { Link } from 'expo-router';
import { Button, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthContext';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Signed in as</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Later permissions</Text>
        <Link href="/(app)/explain/location" style={styles.link}>
          Location (Always)
        </Link>
        <Link href="/(app)/explain/motion" style={styles.link}>
          Motion and Fitness
        </Link>
        <Link href="/(app)/explain/notifications" style={styles.link}>
          Notifications
        </Link>
      </View>

      <Button title="Log out" onPress={() => void signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    gap: 12,
  },
  label: {
    color: '#666',
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  section: {
    marginVertical: 16,
    gap: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  link: {
    color: '#1565c0',
  },
});
