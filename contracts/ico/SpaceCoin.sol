// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ICO.sol";
import "hardhat/console.sol";

/*
   SpaceCoin: an ERC-20 token

   Key features:
   - Allows initiation of an ICO
   - Allows ability to toggle tax on transfers of tokens.
*/
contract SpaceCoin is ERC20, Ownable {
    uint256 public constant supply = 500_000 * 10**18;
    // houses the transfer tax
    address public treasury;

    // a contract set only by the owner to offer initial coins
    // must be of type ICO.sol
    ICO public icoContract;

    // toggle to enable/disable tax on transfers
    bool public taxEnabled = false;

    // set treasury and mint supply!
    constructor(address _treasury) ERC20("space-coin", "SPC") {
        treasury = _treasury;
        icoContract = new ICO(address(this), msg.sender);
        uint256 icoTokens = 5 * 30_000 ether;
        _mint(treasury, supply - icoTokens);
        _mint(address(icoContract), icoTokens);
    }

    // override the erc-20 _transfer (which gets called by transfer & transferFrom)
    // to include a tax if it's enabled by this contract.
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (taxEnabled) {
            uint256 toTreasury = amount / 50; // 2% tax
            uint256 toReceiver = amount - toTreasury;

            super._transfer(from, to, toReceiver);
            super._transfer(from, treasury, toTreasury);
        } else {
            return super._transfer(from, to, amount);
        }
    }

    function toggleTax() external onlyOwner {
        taxEnabled = !taxEnabled;

        emit TaxToggled(msg.sender, taxEnabled);
    }

    event IcoInitiated(address indexed owner, address indexed icoAddress, uint256 fundingGoal);
    event TaxToggled(address indexed owner, bool taxEnabled);
    event ProjectCancelled(address indexed owner, uint256 projectId);
}
