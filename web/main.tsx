import { AppRegistry } from "react-native";
import App from "../src/ui/App";

AppRegistry.registerComponent("Blocks", () => App);
AppRegistry.runApplication("Blocks", {
  rootTag: document.getElementById("root"),
});
