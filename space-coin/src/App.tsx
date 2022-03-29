import React from "react";
import { useAccount } from "wagmi";
import { Connect } from "./Connect/Connect";
import { SpaceRouter } from "./SpaceRouter";
import styles from "./App.module.css";

export const App = () => {
  const [{ data }] = useAccount();

  return (
    <div className={styles.container}>
      <div className={styles.app}>{data?.address ? <SpaceRouter /> : <Connect />}</div>
    </div>
  );
};
