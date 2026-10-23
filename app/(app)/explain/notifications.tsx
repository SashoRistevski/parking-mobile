import { StyleSheet, Text, View } from 'react-native';

export default function NotificationsExplainScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.body}>
        A later version will send local notifications when you may have forgotten
        to pay for parking. Only on-device alerts are planned for now. No
        notification permission is requested here yet.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
});
