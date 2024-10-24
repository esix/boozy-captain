import { StyleSheet, Text, View } from "react-native";
import Menu from "../../widgets/Menu";
import ButtonBar from "../../widgets/ButtonBar";


export default function MainPage() {
  return (
    <View style={styles.container}>
      <View style={{ backgroundColor: 'red', width: '100%'}}><Menu/></View>
      <View style={{ backgroundColor: 'yellow', width: '100%'}}><ButtonBar/></View>
      <Text style={{ flex: 1}}>Boozy Captain</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
});
