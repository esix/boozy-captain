import { Button, StyleSheet, Text, View } from "react-native";
import Menu from "../../widgets/Menu";
import ButtonBar from "../../widgets/ButtonBar";


export default function MainPage() {

  const onRequestAccess = async () => {
    const dirHandle = await window.showDirectoryPicker();

    //const dirHandle = window.getDirectoryHandle
    console.log(dirHandle);
    debugger;
  }


  return (
    <View style={styles.container}>
      <View style={{ backgroundColor: 'red', width: '100%'}}><Menu/></View>
      <View style={{ backgroundColor: 'yellow', width: '100%'}}><ButtonBar/></View>
      <Text style={{ flex: 1}}>Boozy Captain</Text>
      <Button title="Access" onPress={onRequestAccess}/>
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
