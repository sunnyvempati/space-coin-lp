import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";
import { SpaceCoin, SpaceCoin__factory, SpaceRouter } from "../src/types";

task("deploy:SpaceCoin")
  .addParam("treasury", "Treasury account where taxed tokens get sent to")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    // deploy spaceCoin
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying contract: ${deployer.address}`);
    const spaceCoinFactory: SpaceCoin__factory = <SpaceCoin__factory>await ethers.getContractFactory("SpaceCoin");
    const spaceCoin = <SpaceCoin>await spaceCoinFactory.deploy(taskArguments.treasury);
    await spaceCoin.deployed();
    console.log("SpaceCoin deployed to: ", spaceCoin.address);

    // deploy spaceRouter
    console.log(`Deploying spaceRouter contract: ${deployer.address}`);
    const spaceRouterFactory = await ethers.getContractFactory("SpaceRouter");
    const spaceRouter = <SpaceRouter>await spaceRouterFactory.connect(deployer).deploy(spaceCoin.address);
    await spaceRouter.deployed();
    console.log("SpaceRouter deployed to: ", spaceRouter.address);
  });
