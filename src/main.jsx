import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TeaTransportOptimizer from "./Transportation.jsx";
import TeaTransportOptimizer1 from "./Tea.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TeaTransportOptimizer1 />
  </StrictMode>
);
