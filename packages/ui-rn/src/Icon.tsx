import { createElement } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react";

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Adapter that lets us drop a Lucide React icon inside a React Native (Web)
 * tree. Lucide icons render real DOM <svg> elements; on RN-Web that works
 * fine because Views are real <div>s. On native RN this would need swapping
 * for lucide-react-native + react-native-svg — done later in a platform fork.
 */
export function Icon({ icon, size = 16, color = "currentColor", strokeWidth = 1.75, style }: IconProps): JSX.Element {
  return (
    <View
      style={[
        { width: size, height: size, alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      {createElement(icon as unknown as React.ComponentType<{ size: number; color: string; strokeWidth: number }>, {
        size,
        color,
        strokeWidth,
      })}
    </View>
  );
}
