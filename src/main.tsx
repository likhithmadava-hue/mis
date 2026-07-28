import { render } from "preact";
import App from "./App";
import { AuthProvider } from "./core/auth";
import "./index.css";

render(
  <AuthProvider>
    <App />
  </AuthProvider>,
  document.getElementById("root")!,
);
