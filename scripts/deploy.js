const hre = require("hardhat");

async function main() {
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy MultiSigWallet
  const owners = [deployer.address]; // Add more owner addresses as needed
  const requiredSignatures = 1; // Adjust based on your needs
  
  const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
  const multisig = await MultiSigWallet.deploy(owners, requiredSignatures);
  await multisig.waitForDeployment();
  console.log("MultiSigWallet deployed to:", await multisig.getAddress());

  // Deploy TokenDeployer
  const TokenDeployer = await ethers.getContractFactory("TokenDeployer");
  const tokenDeployer = await TokenDeployer.deploy(await multisig.getAddress());
  await tokenDeployer.waitForDeployment();
  console.log("TokenDeployer deployed to:", await tokenDeployer.getAddress());

  // Grant EXECUTOR_ROLE to the TokenDeployer
  const EXECUTOR_ROLE = await multisig.EXECUTOR_ROLE();
  await multisig.grantRole(EXECUTOR_ROLE, await tokenDeployer.getAddress());
  console.log("Granted EXECUTOR_ROLE to TokenDeployer");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 