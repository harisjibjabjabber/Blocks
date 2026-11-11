import { AppRegistry } from "react-native";
import App from "../src/ui/App";

AppRegistry.registerComponent("Blocks", () => App);
const root = document.getElementById("root");
if (!root) throw new Error("Blocks root element is missing.");
AppRegistry.runApplication("Blocks", {
  rootTag: root,
  initialProps: {},
});
