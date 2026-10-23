import { StyleSheet, Text, View } from 'react-native';

export default function MotionExplainScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.body}>
        A later version will use Motion and Fitness to tell driving apart from
        walking or standing still, so parking detection is more reliable. This
        screen does not access motion data yet.
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
