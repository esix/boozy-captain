import * as React from "react";
import {
  StyleSheet,
  GestureResponderEvent,
  Text,
  Pressable, View,
} from "react-native";
import { Button } from "@bc/ui-components";
import AppMenu from "../AppMenu/AppMenu";

export interface MainPageProps {
  children?: any;
}

export function MainPage({ children }: MainPageProps) {
  return (
    <View style={styles.container}>
      <AppMenu/>
      <Text style={styles.header}>WEB</Text>
      <Button
        onClick={() => {
          console.log("Pressed!");
          alert("Pressed!");
        }}
        text="Boop"
      />
      {children}
    </View>);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    height: '100%',
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  header: {
    fontWeight: "bold",
    marginBottom: 20,
    fontSize: 36,
  },
});

