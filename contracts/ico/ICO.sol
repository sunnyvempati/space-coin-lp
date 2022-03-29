// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./SpaceCoin.sol";

/*
   ICO: Initial coin offering for SpaceCoin

   Key features:
   - Allows a private whitelist during the Seed phase to buy tokens with a buying limit.
   - General public get a shot at it with a buying limit.
   - Allows for all to participate in purchasing tokens in the Open phase
   - Users allowed to claim their tokens in Open phase.
*/
contract ICO {
    /// Different phases of ICO; on deployment, contract is in Seed phase
    /// ORDER MATTERS (change logic of bump if you switch order)
    enum Phase {
        Seed,
        General,
        Open
    }

    uint256 public constant maxWhitelistBatch = 100;

    /// funding goal in ETH
    uint256 public constant fundingGoal = 30_000 ether;

    /// goal to hit to move phase to General
    uint256 public constant seedGoal = 15_000 ether;

    /// max amount whitelist users can contribute in seed phase
    uint256 public constant seedMaxContribution = 1_500 ether;

    /// max amount users can buy in general phase
    uint256 public constant generalMaxContribution = 1_000 ether;

    /// Tokens per ETH contributed
    uint256 public constant tokenRate = 5;

    /// whitelisted members that can participate in seed
    mapping(address => bool) private whitelist;

    /// total ETH raised
    uint256 public totalRaised;

    /// ability to pause the funding
    bool public paused = false;

    /// keep track of buyer contributions for checking against contribution limits
    mapping(address => uint256) public buyerContributions;

    /// keep track of owed tokens so users can claim them in phase open
    mapping(address => uint256) public tokensOwed;

    /// seed on init
    Phase public icoPhase = Phase.Seed;

    /// SpaceCoin contract - used to claim tokens
    SpaceCoin public spaceCoin;
    address public spaceCoinOwner;

    modifier onlyTreasury() {
        require(spaceCoin.treasury() == msg.sender, "ICO: Unauthorized");
        _;
    }

    modifier onlyIcoOwner() {
        require(spaceCoinOwner == msg.sender, "ICO: Unauthorized");
        _;
    }

    constructor(address _tokenContract, address _spaceCoinOwner) {
        spaceCoinOwner = _spaceCoinOwner;
        spaceCoin = SpaceCoin(_tokenContract);
    }

    function _isAllowedToBuy() private returns (string memory) {
        if (paused) return "ICO: Paused";

        if (icoPhase == Phase.Seed && !whitelist[msg.sender]) return "ICO: Not whitelisted";
        uint256 userContributions = buyerContributions[msg.sender] + msg.value;
        uint256 maxContributionForUser = whitelist[msg.sender] ? seedMaxContribution : generalMaxContribution;
        uint256 totalContributions = totalRaised + msg.value;
        if (totalContributions > fundingGoal) return "ICO: Goal Reached";
        if (icoPhase != Phase.Open && userContributions > maxContributionForUser) return "ICO: Max limit reached";

        return "";
    }

    // Users call this to buy their tokens by sending it ETH
    // and either receiving tokens or they get reserved for them
    //  to claim during Open phase.
    function buyTokens() external payable {
        string memory result = _isAllowedToBuy();
        require(bytes(result).length == 0, result);
        // Update storage with the new updated counts
        totalRaised += msg.value;
        buyerContributions[msg.sender] += msg.value;
        //---

        // Track tokens
        // Either transfer to user or keep track of what they are owed
        // for them to claim during open or close
        uint256 tokensAccrued = 5 * msg.value;
        if (icoPhase == Phase.Open) {
            spaceCoin.transfer(msg.sender, tokensAccrued);
        } else {
            tokensOwed[msg.sender] += tokensAccrued;
        }
        //---

        emit TokenBuy(msg.sender, msg.value);
    }

    // Users are allowed to claim their tokens when in Open or Closed phase
    // if they are owed any, based on the tokensOwed mapping
    function claim(uint256 amount) external {
        require(icoPhase == Phase.Open, "ICO: Not-available-to-claim");
        require(amount <= tokensOwed[msg.sender], "ICO: Claim-amount-invalid");

        tokensOwed[msg.sender] -= amount;

        spaceCoin.transfer(msg.sender, amount);
    }

    function pause() external onlyIcoOwner {
        paused = true;
        emit ContractPaused();
    }

    function resume() external onlyIcoOwner {
        paused = false;
        emit ContractResumed();
    }

    // Moves the ICO forward by one phase
    function changePhase(Phase newPhase) external onlyIcoOwner {
        Phase nextPhase = Phase(uint256(icoPhase) + 1);
        require(newPhase == nextPhase, "ICO: Invalid phase");
        icoPhase = nextPhase;
        emit ICOPhaseChange(msg.sender, nextPhase);
    }

    /// add to whitelist, max 100
    function addToWhitelist(address[] calldata _whitelist) external onlyIcoOwner {
        require(_whitelist.length <= maxWhitelistBatch, "ICO: Invalid whitelist length");
        for (uint256 i = 0; i < _whitelist.length; i++) {
            whitelist[_whitelist[i]] = true;
            emit AddedToWhitelist(_whitelist[i]);
        }
    }

    /// only treasury can withdraw funds to wherever it wants
    function withdrawFunds(address _to) external onlyTreasury {
        (bool success, ) = _to.call{ value: address(this).balance }("");
        require(success, "ICO: withdraw funds failed");
    }

    event AddedToWhitelist(address indexed account);
    event TokenBuy(address indexed buyer, uint256 amount);
    event ContractPaused();
    event ContractResumed();
    event ICOPhaseChange(address indexed sender, Phase newPhase);
    event ICOContributionWithdraw(address indexed owner, uint256 amount);
}
