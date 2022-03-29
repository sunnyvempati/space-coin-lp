import { BigNumber } from "ethers";
import { ethers } from "hardhat";

const ONE = ethers.BigNumber.from(1);
const TWO = ethers.BigNumber.from(2);

export function sqrt(value: string): BigNumber {
  const x = ethers.BigNumber.from(value);
  let z = x.add(ONE).div(TWO);
  let y = x;
  while (z.sub(y).isNegative()) {
    y = z;
    z = x.div(z).add(z).div(TWO);
  }
  return y;
}

export const SECONDS_IN_A_DAY = 60 * 60 * 24;
export const deadline = (seconds: number) => Date.now() + seconds;
