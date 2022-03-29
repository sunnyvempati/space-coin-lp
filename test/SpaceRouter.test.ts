import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { SpaceCoin, SpaceCoinLP, SpaceRouter, SpaceRouter__factory } from "../src/types";
import { sqrt, deadline, SECONDS_IN_A_DAY } from "./utils";

const { parseEther } = ethers.utils;

describe("SpaceRouter", () => {
  let spaceCoin: SpaceCoin,
    spaceCoinLP: SpaceCoinLP,
    spaceRouter: SpaceRouter,
    spaceCoinOwner: SignerWithAddress,
    treasury: SignerWithAddress,
    lpProvider: SignerWithAddress;
  beforeEach(async () => {
    [spaceCoinOwner, treasury, lpProvider] = await ethers.getSigners();
    const spaceCoinFactory = await ethers.getContractFactory("SpaceCoin");
    spaceCoin = (await spaceCoinFactory.connect(spaceCoinOwner).deploy(treasury.address)) as SpaceCoin;
    await spaceCoin.deployed();

    // transfer tokens to lpProvider for testing
    await spaceCoin.connect(treasury).transfer(lpProvider.address, parseEther("1000"));

    const spaceRouterFactory = await ethers.getContractFactory("SpaceRouter");
    spaceRouter = <SpaceRouter>await spaceRouterFactory.connect(spaceCoinOwner).deploy(spaceCoin.address);
    await spaceRouter.deployed();
    const spaceCoinLPAddress = await spaceRouter.spaceCoinLP();
    spaceCoinLP = <SpaceCoinLP>await ethers.getContractAt("SpaceCoinLP", spaceCoinLPAddress);
  });

  describe("addLiquidity", async () => {
    beforeEach(async () => {
      await spaceCoin.connect(treasury).approve(spaceRouter.address, parseEther("350000"));
      await spaceCoin.connect(lpProvider).approve(spaceRouter.address, parseEther("1000"));
    });

    it("allows users to add liquidity", async () => {
      await expect(() =>
        spaceRouter.connect(treasury).addLiquidity(parseEther("100"), treasury.address, deadline(SECONDS_IN_A_DAY), {
          value: parseEther("20"),
        }),
      ).to.changeTokenBalance(spaceCoinLP, treasury, sqrt(parseEther("20").mul(parseEther("100")).toString()));

      expect(await spaceCoin.balanceOf(spaceCoinLP.address)).to.eq(parseEther("100"));
      expect(await ethers.provider.getBalance(spaceCoinLP.address)).to.eq(parseEther("20"));
    });

    it("calculates correct LP tokens for multiple deposits", async () => {
      await spaceRouter
        .connect(treasury)
        .addLiquidity(parseEther("100"), treasury.address, deadline(SECONDS_IN_A_DAY), {
          value: parseEther("20"),
        });

      await expect(() =>
        spaceRouter.connect(lpProvider).addLiquidity(parseEther("50"), treasury.address, deadline(SECONDS_IN_A_DAY), {
          value: parseEther("10"),
        }),
      ).to.changeTokenBalance(spaceCoinLP, treasury, sqrt(parseEther("10").mul(parseEther("50")).toString()));

      expect(await spaceCoin.balanceOf(spaceCoinLP.address)).to.eq(parseEther("150"));
      expect(await ethers.provider.getBalance(spaceCoinLP.address)).to.eq(parseEther("30"));
    });

    it("only mints lowest ratio possible", async () => {
      await spaceRouter
        .connect(treasury)
        .addLiquidity(parseEther("100"), treasury.address, deadline(SECONDS_IN_A_DAY), {
          value: parseEther("20"),
        });

      // send 10 eth and 100 tokens
      // get LP back only for 10eth and 50tokens
      await expect(() =>
        spaceRouter.connect(lpProvider).addLiquidity(parseEther("100"), treasury.address, deadline(SECONDS_IN_A_DAY), {
          value: parseEther("10"),
        }),
      ).to.changeTokenBalance(spaceCoinLP, treasury, sqrt(parseEther("10").mul(parseEther("50")).toString()));

      expect(await spaceCoin.balanceOf(spaceCoinLP.address)).to.eq(parseEther("150"));
      expect(await ethers.provider.getBalance(spaceCoinLP.address)).to.eq(parseEther("30"));

      // send 20 eth and 20 tokens
      // get LP back only for 4eth and 20tokens
      await expect(() =>
        spaceRouter.connect(lpProvider).addLiquidity(parseEther("20"), treasury.address, deadline(SECONDS_IN_A_DAY), {
          value: parseEther("20"),
        }),
      ).to.changeTokenBalance(spaceCoinLP, treasury, sqrt(parseEther("4").mul(parseEther("20")).toString()));

      expect(await spaceCoin.balanceOf(spaceCoinLP.address)).to.eq(parseEther("170"));
      expect(await ethers.provider.getBalance(spaceCoinLP.address)).to.eq(parseEther("34"));
    });
  });

  describe("removeLiquidity", async () => {
    beforeEach(async () => {
      await spaceCoin.connect(treasury).approve(spaceRouter.address, parseEther("350000"));
      await spaceCoin.connect(lpProvider).approve(spaceRouter.address, parseEther("1000"));
      // add initial liquidity
      await spaceRouter
        .connect(treasury)
        .addLiquidity(parseEther("100"), treasury.address, deadline(SECONDS_IN_A_DAY), {
          value: parseEther("20"),
        });
      // add some more
      await spaceRouter
        .connect(lpProvider)
        .addLiquidity(parseEther("50"), lpProvider.address, deadline(SECONDS_IN_A_DAY), {
          value: parseEther("10"),
        });

      // approve all LP tokens to be transferred
      await spaceCoinLP.connect(treasury).approve(spaceRouter.address, parseEther("1000"));
      await spaceCoinLP.connect(lpProvider).approve(spaceRouter.address, parseEther("1000"));
    });

    it("allows LP to remove liquidity correctly in SPC", async () => {
      const totalLP = await spaceCoinLP.totalSupply();
      await expect(() =>
        spaceRouter.connect(treasury).removeLiquidity(parseEther("5"), treasury.address, deadline(SECONDS_IN_A_DAY)),
      ).to.changeTokenBalance(spaceCoin, treasury, parseEther("5").mul(parseEther("150")).div(totalLP));
    });

    it("allows LP to remove liquidity correctly in SPC", async () => {
      const totalLP = await spaceCoinLP.totalSupply();
      await expect(() =>
        spaceRouter.connect(treasury).removeLiquidity(parseEther("5"), treasury.address, deadline(SECONDS_IN_A_DAY)),
      ).to.changeEtherBalance(treasury, parseEther("5").mul(parseEther("30")).div(totalLP));
    });

    it("doesn't allow you to withdraw LP you don't own", async () => {
      await expect(
        spaceRouter
          .connect(lpProvider)
          .removeLiquidity(parseEther("50"), lpProvider.address, deadline(SECONDS_IN_A_DAY)),
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

      // this works though
      await spaceRouter
        .connect(lpProvider)
        .removeLiquidity(parseEther("20"), lpProvider.address, deadline(SECONDS_IN_A_DAY));
    });
  });

  describe("swapSPCforETH", async () => {
    let etherReserves: BigNumber, spcReserves: BigNumber, kOrig: BigNumber, calcEth: (spc: BigNumber) => BigNumber;
    beforeEach(async () => {
      await spaceCoin.connect(treasury).approve(spaceRouter.address, parseEther("350000"));
      await spaceCoin.connect(lpProvider).approve(spaceRouter.address, parseEther("1000"));
      // add initial liquidity
      await spaceRouter
        .connect(treasury)
        .addLiquidity(parseEther("100"), treasury.address, deadline(SECONDS_IN_A_DAY), {
          value: parseEther("20"),
        });
      etherReserves = await spaceCoinLP.ethReserves();
      spcReserves = await spaceCoinLP.spaceCoinReserves();
      kOrig = etherReserves.mul(spcReserves);
      calcEth = spc => {
        const ethWithoutTax = etherReserves.sub(kOrig.div(spcReserves.add(spc)));
        return ethWithoutTax.sub(ethWithoutTax.div(100));
      };
    });

    it("returns correct ETH for SPC", async () => {
      // lpProvider is our swapper in this test
      const coinsToTrade = parseEther("5");
      await expect(() =>
        spaceRouter.connect(lpProvider).swapSPCForETH(coinsToTrade, lpProvider.address, 0, deadline(SECONDS_IN_A_DAY)),
      ).to.changeEtherBalance(lpProvider, calcEth(coinsToTrade));
    });

    it("reverts when slippage req isn't met", async () => {
      await expect(
        spaceRouter
          .connect(lpProvider)
          .swapSPCForETH(parseEther("5"), lpProvider.address, parseEther("1"), deadline(SECONDS_IN_A_DAY)),
      ).to.be.revertedWith("SpaceRouter: Minimum eth not met");
    });

    it("reverts when invalid amount is sent", async () => {
      await expect(
        spaceRouter.connect(lpProvider).swapSPCForETH(0, lpProvider.address, 0, deadline(SECONDS_IN_A_DAY)),
      ).to.be.revertedWith("SpaceCoinLP: Invalid amounts for swap");
    });
  });

  describe("swapETHforSPC", async () => {
    let etherReserves: BigNumber, spcReserves: BigNumber, kOrig: BigNumber, calcSpc: (eth: BigNumber) => BigNumber;
    beforeEach(async () => {
      await spaceCoin.connect(treasury).approve(spaceRouter.address, parseEther("350000"));
      await spaceCoin.connect(lpProvider).approve(spaceRouter.address, parseEther("1000"));
      // add initial liquidity
      await spaceRouter
        .connect(treasury)
        .addLiquidity(parseEther("100"), treasury.address, deadline(SECONDS_IN_A_DAY), {
          value: parseEther("20"),
        });
      etherReserves = await spaceCoinLP.ethReserves();
      spcReserves = await spaceCoinLP.spaceCoinReserves();
      kOrig = etherReserves.mul(spcReserves);
      calcSpc = eth => {
        const spcWithoutTax = spcReserves.sub(kOrig.div(etherReserves.add(eth)));
        return spcWithoutTax.sub(spcWithoutTax.div(100));
      };
    });

    it("returns correct ETH for SPC", async () => {
      // lpProvider is our swapper in this test
      await expect(() =>
        spaceRouter
          .connect(lpProvider)
          .swapEthForSPC(lpProvider.address, 0, deadline(SECONDS_IN_A_DAY), { value: parseEther("500") }),
      ).to.changeTokenBalance(spaceCoin, lpProvider, calcSpc(parseEther("500")));
    });

    it("reverts when slippage req isn't met", async () => {
      await expect(
        spaceRouter
          .connect(lpProvider)
          .swapEthForSPC(lpProvider.address, parseEther("100"), deadline(SECONDS_IN_A_DAY), { value: parseEther("2") }),
      ).to.be.revertedWith("SpaceRouter: Minimum SpaceCoins not met");
    });

    it("reverts when invalid amount is sent", async () => {
      await expect(
        spaceRouter.connect(lpProvider).swapEthForSPC(lpProvider.address, 0, deadline(SECONDS_IN_A_DAY)),
      ).to.be.revertedWith("SpaceCoinLP: Invalid amounts for swap");
    });
  });
});
