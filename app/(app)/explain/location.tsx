import { StyleSheet, Text, View } from 'react-native';

export default function LocationExplainScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.body}>
        A later version will ask for Location set to Always so the app can
        notice when you park in a paid zone, even when the app is in the
        background. Nothing is requested on this screen yet.
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
