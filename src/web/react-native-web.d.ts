// Vite maps react-native to react-native-web. Keep its DOM data attributes
// explicit without weakening the native component or application types.
import "react-native";

declare module "react-native" {
  namespace AppRegistry {
    function runApplication(appKey: string, parameters: { rootTag: HTMLElement; initialProps?: Record<string, unknown> }): void;
  }
  interface ViewProps {
    dataSet?: Record<string, string | number | boolean>;
  }
  interface PressableProps {
    dataSet?: Record<string, string | number | boolean>;
  }
}
