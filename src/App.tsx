import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import ButtonPanel from "./components/ButtonPanel";

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Boozy Commander</Text>
      <ButtonPanel/>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
