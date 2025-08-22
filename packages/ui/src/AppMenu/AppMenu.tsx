import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface AppMenuProps {
  children?: any;
}

export default function AppMenu() {
  return (
    <View style={styles.appMenu}>
      <Text>File</Text>
      <Text>Mark</Text>
      <Text>Commands</Text>
      <Text>Net</Text>
      <Text>Show</Text>
      <Text>Configuration</Text>
      <Text>Start</Text>
    </View>);
}

const styles = StyleSheet.create({
  appMenu: {
    flexGrow: 0,
    flexShrink: 0,
    height: 20,
    width: '100%',
    backgroundColor: "yellow",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
});

