import React, { useState } from "react";
import { useAccount } from "wagmi";
import { LP } from "../LP";
import { Swap } from "../Swap";
import styles from "./SpaceRouter.module.css";

export const SpaceRouter = () => {
  const [{ data: accountData }] = useAccount();
  const [page, setPage] = useState<"swap" | "lp">("swap");

  const pageCss = {
    fontWeight: "600",
    textDecoration: "underline",
  };

  return accountData?.address ? (
    <div className={styles.container}>
      <div className={styles.menu}>
        <div onClick={() => setPage("swap")} className={styles.page} style={page === "swap" ? pageCss : {}}>
          Swap
        </div>
        <div onClick={() => setPage("lp")} className={styles.page} style={page === "lp" ? pageCss : {}}>
          Pool
        </div>
      </div>
      <div className={styles.page}>
        {page === "swap" ? <Swap userAddress={accountData?.address} /> : <LP userAddress={accountData?.address} />}
      </div>
    </div>
  ) : (
    <div>"Loading..."</div>
  );
};
