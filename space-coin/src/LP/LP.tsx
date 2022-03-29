import { BigNumber, ethers } from "ethers";
import React, { useCallback, useMemo, useState } from "react";
import styles from "./LP.module.css";
import { useBalance, useContractRead, useContractWrite } from "wagmi";
import { TextField } from "@mui/material";
import SpaceCoin from "../abis/SpaceCoin.json";
import SpaceRouter from "../abis/SpaceRouter.json";
import SpaceCoinLP from "../abis/SpaceCoinLP.json";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import LoadingButton from "@mui/lab/LoadingButton";
import {
  DEADLINE,
  formatToDecimal,
  SPACE_COIN_ADDRESS,
  SPACE_COIN_LP_ADDRESS,
  SPACE_ROUTER_ADDRESS,
} from "../constants";

const {
  utils: { parseEther },
} = ethers;

export const LP: React.FC<{ userAddress: string }> = ({ userAddress }) => {
  const [ethVal, setEthVal] = useState<string>("");
  const [spcVal, setSpcVal] = useState<string>("");
  const [lpVal, setLpVal] = useState<string>("");
  const [{ data: balance }] = useBalance({
    addressOrName: userAddress,
  });

  const [{ data: spcData }] = useBalance({
    addressOrName: userAddress,
    token: SPACE_COIN_ADDRESS,
  });

  const [{ data: lpTokens }] = useBalance({
    addressOrName: userAddress,
    token: SPACE_COIN_LP_ADDRESS,
  });

  const [{ loading: approveLoading }, approve] = useContractWrite(
    {
      addressOrName: SPACE_COIN_ADDRESS,
      contractInterface: SpaceCoin.abi,
    },
    "approve",
  );

  const [{ loading: approveLpLoading }, approveLp] = useContractWrite(
    {
      addressOrName: SPACE_COIN_LP_ADDRESS,
      contractInterface: SpaceCoinLP.abi,
    },
    "approve",
  );

  const [{ data: allowanceData }, getAllowance] = useContractRead(
    {
      addressOrName: SPACE_COIN_ADDRESS,
      contractInterface: SpaceCoin.abi,
    },
    "allowance",
    { args: [userAddress, SPACE_ROUTER_ADDRESS] },
  );

  const [{ loading: supplyLoading }, supply] = useContractWrite(
    {
      addressOrName: SPACE_ROUTER_ADDRESS,
      contractInterface: SpaceRouter.abi,
    },
    "addLiquidity",
  );

  const [{ loading: loadingRemove }, remove] = useContractWrite(
    {
      addressOrName: SPACE_ROUTER_ADDRESS,
      contractInterface: SpaceRouter.abi,
    },
    "removeLiquidity",
  );

  const handleSubmit = useCallback(() => {
    supply({
      args: [parseEther(spcVal), userAddress, DEADLINE],
      overrides: { value: parseEther(ethVal) },
    });
  }, [ethVal, spcVal, supply, userAddress]);

  const handleApprove = useCallback(() => {
    if (spcData?.value) {
      approve({ args: [SPACE_ROUTER_ADDRESS, spcData?.value] }).then(() => {
        getAllowance();
      });
    }
  }, [approve, spcData, getAllowance]);

  const handleApproveLP = useCallback(() => {
    if (lpTokens?.value) {
      approveLp({ args: [SPACE_ROUTER_ADDRESS, lpTokens?.value] });
    }
  }, [approveLp, lpTokens]);

  const handleRemove = useCallback(() => {
    remove({ args: [parseEther(lpVal), userAddress, DEADLINE] });
  }, [lpVal, remove, userAddress]);

  return (
    <div className={styles.container}>
      <div className={styles.add} style={lpTokens && !lpTokens.value.eq(0) ? { borderRight: "1px solid #f4f4f4" } : {}}>
        <div className={styles.inputContainer}>
          <div className={styles.input}>
            <div className={styles.inputBox}>
              <TextField
                id="eth"
                variant="standard"
                placeholder="0.000"
                value={ethVal}
                onChange={e => setEthVal(e.target.value)}
              />
              <div className={styles.label}>ETH</div>
            </div>
            <div className={styles.balance}>Balance: {formatToDecimal(balance?.formatted)}</div>
          </div>

          <AddRoundedIcon color="secondary" fontSize="large" />
          <div className={styles.input}>
            <div className={styles.inputBox}>
              <TextField
                id="spc"
                variant="standard"
                placeholder="0.000"
                value={spcVal}
                onChange={e => setSpcVal(e.target.value)}
              />
              <div className={styles.label}>SPC</div>
            </div>
            <div className={styles.balance}>SPC: {formatToDecimal(spcData?.formatted)}</div>
          </div>
        </div>

        <div className={styles.actions}>
          {allowanceData && BigNumber.from(allowanceData).eq("0") && (
            <LoadingButton
              disabled={spcData && spcData.value.eq(0)}
              loading={approveLoading}
              variant="contained"
              onClick={handleApprove}
            >
              Approve
            </LoadingButton>
          )}

          <LoadingButton
            disabled={spcData && spcData.value.eq(0)}
            loading={supplyLoading}
            variant="contained"
            onClick={handleSubmit}
          >
            Supply
          </LoadingButton>
        </div>
      </div>
      {lpTokens && !lpTokens.value.eq(0) && (
        <div className={styles.remove}>
          <div className={styles.inputContainer}>
            <div className={styles.input}>
              <div className={styles.inputBox}>
                <TextField
                  id="lp"
                  variant="standard"
                  placeholder="0.000"
                  value={lpVal}
                  onChange={e => setLpVal(e.target.value)}
                />
                <div className={styles.label}>LP</div>
              </div>
              <div className={styles.balance}>LP: {lpTokens?.formatted}</div>
              <div style={{ marginBottom: "12px" }} />
              <LoadingButton
                style={{ marginBottom: "12px" }}
                disabled={!!(!lpVal.length || (lpTokens && lpVal.length && parseEther(lpVal).gt(lpTokens.value)))}
                loading={approveLpLoading}
                variant="contained"
                onClick={handleApproveLP}
              >
                Approve
              </LoadingButton>
              <LoadingButton
                disabled={!!(!lpVal.length || (lpTokens && lpVal.length && parseEther(lpVal).gt(lpTokens.value)))}
                loading={loadingRemove}
                variant="contained"
                onClick={handleRemove}
              >
                Remove
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
