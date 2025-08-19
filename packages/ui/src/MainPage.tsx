import * as React from "react";
import {
  StyleSheet,
  GestureResponderEvent,
  Text,
  Pressable, View,
} from "react-native";
import { Button } from "@boozy/ui-components";

export interface MainPageProps {
  children?: any;
}

export function MainPage({ children }: MainPageProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>WEB</Text>
      <Button
        onClick={() => {
          console.log("Pressed!");
          alert("Pressed!");
        }}
        text="Boop"
      />
      {children}
    </View>  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    fontWeight: "bold",
    marginBottom: 20,
    fontSize: 36,
  },
});

