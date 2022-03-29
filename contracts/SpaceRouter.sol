// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./ico/SpaceCoin.sol";
import "./SpaceCoinLP.sol";

/*
    SpaceRouter allows users to add liquidity or remove from the SPC-ETH pool
    Users have the ability to also swap SPC<>ETH
*/
contract SpaceRouter {
    /// spaceCoin token contract
    SpaceCoin public spaceCoin;

    /// spaceCoin<>Eth liquidity pool contract
    SpaceCoinLP public spaceCoinLP;

    /// prices to display on FE
    uint256 public ethPrice;
    uint256 public spcPrice;

    constructor(address _spaceCoin) {
        spaceCoin = SpaceCoin(_spaceCoin);
        spaceCoinLP = new SpaceCoinLP(_spaceCoin);
    }

    modifier meets(uint256 deadline) {
        require(block.timestamp <= deadline, "SpaceRouter: Past deadline");
        _;
    }

    /// send eth and spc and this function will transfer you LP tokens if you meet the criteria
    function addLiquidity(
        uint256 _tokens,
        address _to,
        uint256 deadline
    ) external payable meets(deadline) returns (uint256 owedLPTokens) {
        // any excess coins or eth sent is sussed out here and the optimal amounts are returned
        (uint256 spaceCoins, uint256 eth) = _calculateOptimalAmounts(_tokens);
        spaceCoin.transferFrom(msg.sender, address(spaceCoinLP), spaceCoins);
        owedLPTokens = spaceCoinLP.mint{ value: eth }(_to);

        // send back extra ETH
        if (eth < msg.value) {
            (bool success, ) = msg.sender.call{ value: msg.value - eth }("");
            require(success, "SpaceRouter: Returning excess eth failed");
        }
    }

    /// return liquidity to user based on amount requested
    function removeLiquidity(
        uint256 _amount,
        address _to,
        uint256 deadline
    ) external meets(deadline) returns (uint256 owedSpaceCoins, uint256 owedEth) {
        // first transfer to liquidity pool and the pool will take care of figuring out how
        // much liquidity to return back to user
        spaceCoinLP.transferFrom(msg.sender, address(spaceCoinLP), _amount);
        (owedSpaceCoins, owedEth) = spaceCoinLP.burn(_to);
    }

    /// SPC for ETH
    function swapSPCForETH(
        uint256 _tokens,
        address _to,
        uint256 minEth, // slippage
        uint256 deadline
    ) external meets(deadline) {
        // main calculation to determine how much ETH to swap for the specified SPC
        // 1% tax on swaps taken out in liquidity pool
        uint256 ethOut = getEthValueForSpc(_tokens);
        require(ethOut >= minEth, "SpaceRouter: Minimum eth not met");

        spaceCoin.transferFrom(msg.sender, address(spaceCoinLP), _tokens);
        spaceCoinLP.swap(_to, 0, ethOut);
    }

    /// ETH for SPC
    function swapEthForSPC(
        address _to,
        uint256 minSpaceCoins, // slipagge
        uint256 deadline
    ) external payable meets(deadline) {
        // same calculation as above
        // 1% tax on swaps taken out in liquidity pool
        uint256 tokensOut = getSpcValueForEth(msg.value);

        require(tokensOut >= minSpaceCoins, "SpaceRouter: Minimum SpaceCoins not met");

        spaceCoinLP.swap{ value: msg.value }(_to, tokensOut, 0);
    }

    /// helper functions to calculate how much value to expect from swap
    function getEthValueForSpc(uint256 spc) public view returns (uint256 eth) {
        uint256 _spaceCoinReserves = spaceCoinLP.spaceCoinReserves();
        uint256 _ethReserves = spaceCoinLP.ethReserves();
        eth = _ethReserves - ((_spaceCoinReserves * _ethReserves) / (_spaceCoinReserves + spc));
    }

    function getSpcValueForEth(uint256 eth) public view returns (uint256 spc) {
        uint256 _spaceCoinReserves = spaceCoinLP.spaceCoinReserves();
        uint256 _ethReserves = spaceCoinLP.ethReserves();
        spc = _spaceCoinReserves - ((_spaceCoinReserves * _ethReserves) / (_ethReserves + eth));
    }

    // ----

    function _calculateOptimalAmounts(uint256 sentSpaceCoins) private returns (uint256, uint256) {
        uint256 sentEth = msg.value;
        uint256 _ethReserves = spaceCoinLP.ethReserves();
        uint256 _spaceCoinReserves = spaceCoinLP.spaceCoinReserves();

        if (_ethReserves == 0 && _spaceCoinReserves == 0) {
            return (sentSpaceCoins, sentEth);
        }

        uint256 optimalEth = (sentSpaceCoins * _ethReserves) / _spaceCoinReserves;

        if (sentEth >= optimalEth) {
            // if user sent more eth than optimal, then we have the match
            return (sentSpaceCoins, optimalEth);
        } else {
            // otherwise, calculate space coins based on eth that was actually sent
            uint256 optimalSpaceCoins = (sentEth * _spaceCoinReserves) / _ethReserves;
            return (optimalSpaceCoins, sentEth);
        }
    }
}
