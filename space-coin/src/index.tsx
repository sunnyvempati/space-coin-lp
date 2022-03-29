import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import { Provider } from "wagmi";
import { App } from "./App";
import { providers } from "ethers";

ReactDOM.render(
  <React.StrictMode>
    <Provider
      autoConnect
      provider={({ chainId }) => new providers.AlchemyProvider(chainId, "UHzDMSFgPu9vMekKeNIWfp5Pa0Xgk-7N")}
    >
      <App />
    </Provider>
  </React.StrictMode>,
  document.getElementById("root"),
);
