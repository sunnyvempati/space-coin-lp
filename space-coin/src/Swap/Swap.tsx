import { BigNumber, ethers } from "ethers";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./Swap.module.css";
import { useBalance, useContractRead, useContractWrite, useToken } from "wagmi";
import SpaceCoin from "../abis/SpaceCoin.json";
import SpaceRouter from "../abis/SpaceRouter.json";
import { TextField } from "@mui/material";
import LoadingButton from "@mui/lab/LoadingButton";
import PercentRoundedIcon from "@mui/icons-material/PercentRounded";
import SwapVertRoundedIcon from "@mui/icons-material/SwapVertRounded";
import { DEADLINE, SPACE_COIN_ADDRESS, SPACE_COIN_LP_ADDRESS, SPACE_ROUTER_ADDRESS } from "../constants";

const {
  utils: { parseEther, formatEther },
} = ethers;

const calculateSlippage = (amount: BigNumber, slippage: string) => amount.sub(amount.div(100 / parseInt(slippage)));

export const Swap: React.FC<{ userAddress: string }> = ({ userAddress }) => {
  const [swapDirection, setSwapDirection] = useState<"swapEthForSPC" | "swapSPCForETH">("swapEthForSPC");
  const [ethVal, setEthVal] = useState<string>("");
  const [spcVal, setSpcVal] = useState<string>("");
  const [slippage, setSlippage] = useState<string>("1");
  const [hasLiquidity, setHasLiquidity] = useState<boolean>(false);

  const [{ data: ethBalance }] = useBalance({
    addressOrName: userAddress,
  });
  const [{ data: lpTokenData }] = useToken({
    address: SPACE_COIN_LP_ADDRESS,
  });

  const [{ data: spcBalance }] = useBalance({
    addressOrName: userAddress,
    token: SPACE_COIN_ADDRESS,
  });

  const [{ loading: loadingEth }, getEthForSpc] = useContractRead(
    {
      addressOrName: SPACE_ROUTER_ADDRESS,
      contractInterface: SpaceRouter.abi,
    },
    "getEthValueForSpc",
  );

  const [{ loading: loadingSPC }, getSpcForEth] = useContractRead(
    {
      addressOrName: SPACE_ROUTER_ADDRESS,
      contractInterface: SpaceRouter.abi,
    },
    "getSpcValueForEth",
  );

  const [{ loading: approveLoading }, approve] = useContractWrite(
    {
      addressOrName: SPACE_COIN_ADDRESS,
      contractInterface: SpaceCoin.abi,
    },
    "approve",
  );

  const [{ loading: loadingSwap }, swap] = useContractWrite(
    {
      addressOrName: SPACE_ROUTER_ADDRESS,
      contractInterface: SpaceRouter.abi,
    },
    swapDirection,
  );

  useEffect(() => {
    if (lpTokenData && lpTokenData.totalSupply) {
      setHasLiquidity(!lpTokenData.totalSupply.value.eq(0));
    }
  }, [lpTokenData]);

  const handleSwap = useCallback(() => {
    swap({
      args:
        swapDirection === "swapEthForSPC"
          ? [userAddress, calculateSlippage(parseEther(spcVal), slippage), DEADLINE]
          : [spcVal, userAddress, calculateSlippage(parseEther(ethVal), slippage), DEADLINE],
      overrides: swapDirection === "swapEthForSPC" ? { value: parseEther(ethVal) } : {},
    });
  }, [ethVal, spcVal, slippage, swap, swapDirection, userAddress]);

  const handleApprove = useCallback(() => {
    if (spcBalance?.value) {
      approve({ args: [SPACE_ROUTER_ADDRESS, spcBalance?.value] });
    }
  }, [approve, spcBalance]);

  const insufficientFunds = useMemo(() => {
    if (ethBalance?.value && spcBalance?.value && ethVal.length && spcVal.length) {
      return swapDirection === "swapEthForSPC"
        ? ethBalance?.value.lt(parseEther(ethVal))
        : spcBalance?.value.lt(parseEther(spcVal));
    } else {
      return true;
    }
  }, [swapDirection, ethBalance, ethVal, spcBalance, spcVal]);

  const ethInput = (
    <div className={styles.inputBox}>
      <TextField
        id="eth"
        variant="standard"
        placeholder="0.000"
        value={ethVal}
        onChange={e => {
          setEthVal(e.target.value);
          getSpcForEth({ args: [parseEther(e.target.value)] }).then(({ data }) => {
            if (data) {
              setSpcVal(formatEther(data));
            }
          });
        }}
      />
      <div className={styles.label}>ETH</div>
    </div>
  );

  const spcInput = (
    <div className={styles.inputBox}>
      <TextField
        id="spc"
        variant="standard"
        placeholder="0.000"
        value={spcVal}
        onChange={e => {
          setSpcVal(e.target.value);
          getEthForSpc({ args: [parseEther(e.target.value)] }).then(({ data }) => {
            if (data) {
              setEthVal(formatEther(data));
            }
          });
        }}
      />
      <div className={styles.label}>SPC</div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.inputContainer}>
        {swapDirection === "swapEthForSPC" ? ethInput : spcInput}
        <SwapVertRoundedIcon
          color="secondary"
          fontSize="large"
          onClick={() => setSwapDirection(swapDirection === "swapEthForSPC" ? "swapSPCForETH" : "swapEthForSPC")}
        />
        {swapDirection === "swapEthForSPC" ? spcInput : ethInput}
      </div>

      <div className={styles.slip}>
        <TextField
          id="slip"
          label="SLIPPAGE"
          variant="standard"
          size="small"
          value={slippage}
          disabled={loadingEth || loadingSPC}
          onChange={e => setSlippage(e.target.value)}
        />
        <PercentRoundedIcon />
      </div>

      <div className={styles.actions}>
        {swapDirection === "swapSPCForETH" && (
          <LoadingButton
            loading={approveLoading || loadingEth || loadingSPC}
            disabled={!hasLiquidity || insufficientFunds}
            variant="contained"
            onClick={handleApprove}
          >
            Approve
          </LoadingButton>
        )}

        <LoadingButton
          disabled={!hasLiquidity || loadingEth || loadingSPC || insufficientFunds}
          loading={loadingSwap}
          variant="contained"
          onClick={handleSwap}
        >
          {insufficientFunds ? "Insufficient" : "Swap"}
        </LoadingButton>
      </div>
    </div>
  );
};
