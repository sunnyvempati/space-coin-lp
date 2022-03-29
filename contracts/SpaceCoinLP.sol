// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ico/SpaceCoin.sol";

/*
    Liquidity Pool for SPC <-> ETH
*/
contract SpaceCoinLP is ERC20, ReentrancyGuard {
    /// ETH value held by contract prior to current transaction
    uint256 public ethReserves;

    /// SpaceCoins held by contract prior to current transaction
    uint256 public spaceCoinReserves;

    /// SpaceCoin Token -- mainly used to check balances
    SpaceCoin public spaceCoin;

    constructor(address _spaceCoin) ERC20("Space-coin-lp", "SPCETH") {
        spaceCoin = SpaceCoin(_spaceCoin);
    }

    /// mint: used to add liquidity to pool; mints new tokens and stores liquidity
    function mint(address _to) external payable nonReentrant returns (uint256 owedLPTokens) {
        // get owed LP tokens based on what's been transferred to this contract from router
        owedLPTokens = _calculateOwedTokens();
        require(owedLPTokens > 0, "SpaceCoinLP: Invalid liquidity");
        _mint(_to, owedLPTokens);
        _syncReserves(); // always sync reserves with every external call
    }

    /// burn: used to remove liquidity from pool; router transfers lp tokens to burn and return liquidity to user
    function burn(address _to) external nonReentrant returns (uint256 owedSpaceCoins, uint256 owedEth) {
        uint256 lpToBurn = balanceOf(address(this));
        require(lpToBurn > 0, "SpaceCoinLP: No LP to trade");
        uint256 _totalSupply = totalSupply();
        // calculation to find liquidity for the pair based on lp tokens
        owedSpaceCoins = (lpToBurn * spaceCoinReserves) / _totalSupply;
        owedEth = (lpToBurn * ethReserves) / _totalSupply;

        spaceCoin.transfer(_to, owedSpaceCoins);
        _transferEth(_to, owedEth);
        _burn(address(this), lpToBurn);

        _syncReserves();
    }

    /// swap: swap spaceCoins to ETH and vice versa
    function swap(
        address _to,
        uint256 spaceCoinsOut,
        uint256 ethOut
    ) external payable nonReentrant {
        require(spaceCoinsOut > 0 || ethOut > 0, "SpaceCoinLP: Invalid amounts for swap");
        require(spaceCoinsOut < spaceCoinReserves && ethOut < ethReserves, "SpaceCoinLP: Funds unavailable");
        // 1% fee
        uint256 spaceCoinsOutFee = spaceCoinsOut / 100;
        uint256 ethOutFee = ethOut / 100;
        // --

        // transfer liquidity out first, so we can check value of LP after
        if (spaceCoinsOut > 0) spaceCoin.transfer(_to, spaceCoinsOut - spaceCoinsOutFee);
        if (ethOut > 0) _transferEth(_to, ethOut - ethOutFee);

        // check value of assets is equal or greater after swap
        uint256 previousValue = ethReserves * spaceCoinReserves;
        uint256 currentValue = (spaceCoin.balanceOf(address(this))) * (address(this).balance);

        require(currentValue > previousValue, "SpaceCoinLP: Invalid swap");

        _syncReserves();
    }

    function _transferEth(address _to, uint256 value) private {
        (bool success, ) = _to.call{ value: value }("");
        require(success, "SpaceCoinLP: Failed to transfer ETH to user");
    }

    /// used when adding liquidity to determine the ratio of the ETH-SPC pair
    function _calculateOwedTokens() private view returns (uint256) {
        uint256 _spaceCoinBalance = spaceCoin.balanceOf(address(this));
        uint256 _ethBalance = address(this).balance;
        uint256 _totalSupply = totalSupply();
        uint256 _spaceCoinReserves = spaceCoinReserves;
        uint256 _ethReserves = ethReserves;

        if (_totalSupply == 0) {
            // if no supply exists, quick simple uniswap equation
            return Math.sqrt(_spaceCoinBalance * _ethBalance);
        } else {
            uint256 spaceCoinsDelta = _spaceCoinBalance - _spaceCoinReserves;
            uint256 ethDelta = _ethBalance - _ethReserves;
            // if disproportionate values are sent, only provide LP tokens for lowest value
            // excess gets distributed to the LP token holders
            uint256 owedLPViaSpaceCoins = (spaceCoinsDelta * _totalSupply) / _spaceCoinReserves;
            uint256 owedLPViaEth = (ethDelta * _totalSupply) / _ethReserves;
            return Math.min(owedLPViaSpaceCoins, owedLPViaEth);
        }
    }

    function _syncReserves() private {
        spaceCoinReserves = spaceCoin.balanceOf(address(this));
        ethReserves = address(this).balance;
    }
}

/* grabbed directly from uniswap */
library Math {
    function min(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x < y ? x : y;
    }

    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
