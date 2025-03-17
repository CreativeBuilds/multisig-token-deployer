const { ethers } = require("hardhat");
const { expect } = require("chai");
const readline = require('readline');
const http = require('http');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function isNetworkRunning() {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 8545,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(options, (res) => {
            resolve(res.statusCode === 200);
        });

        req.on('error', () => {
            resolve(false);
        });

        req.end(JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
        }));
    });
}

async function main() {
    try {
        console.log("\nChecking if local network is running...");
        
        if (!await isNetworkRunning()) {
            console.error("\nLocal network not detected!");
            console.error("\nTo start the local network, open a new terminal and run:");
            console.error("npx hardhat node\n");
            console.error("Then in this terminal, run:");
            console.error("npx hardhat run scripts/walkthrough.js --network localhost\n");
            process.exit(1);
        }
        
        console.log("Local network detected, proceeding with walkthrough...\n");
        
        console.log("=== ERC20 Token Deployer Walkthrough ===\n");
        console.log("This script will demonstrate how the MultiSigWallet and TokenDeployer contracts work together.\n");
        
        // Get signers
        const [deployer, voter1, voter2, voter3, addr1] = await ethers.getSigners();
        console.log("Accounts loaded:");
        console.log(`Deployer: ${deployer.address}`);
        console.log(`Voter 1: ${voter1.address}`);
        console.log(`Voter 2: ${voter2.address}`);
        console.log(`Voter 3: ${voter3.address}`);
        console.log(`Test Address: ${addr1.address}\n`);
        
        await question("Press Enter to continue...");
        
        // Deploy MultiSigWallet
        console.log("Step 1: Deploying MultiSigWallet");
        console.log("The MultiSigWallet requires multiple signatures to execute transactions.");
        console.log("We'll set it up with 3 voters and require 2 signatures for execution.\n");
        
        const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
        const multisig = await MultiSigWallet.deploy([voter1.address, voter2.address, voter3.address], 2);
        await multisig.waitForDeployment();
        console.log(`MultiSigWallet deployed to: ${await multisig.getAddress()}`);
        console.log(`Required signatures: ${await multisig.requiredSignatures()}`);
        
        await question("Press Enter to continue...");
        
        // Deploy TokenDeployer
        console.log("\nStep 2: Deploying TokenDeployer");
        console.log("The TokenDeployer contract will be owned by the MultiSigWallet.");
        console.log("This means only the MultiSigWallet can deploy new tokens.\n");
        
        const TokenDeployer = await ethers.getContractFactory("TokenDeployer");
        const tokenDeployer = await TokenDeployer.deploy(await multisig.getAddress());
        await tokenDeployer.waitForDeployment();
        console.log(`TokenDeployer deployed to: ${await tokenDeployer.getAddress()}`);
        console.log(`TokenDeployer owner: ${await tokenDeployer.owner()}`);
        
        await question("Press Enter to continue...");
        
        // Deploy a new token
        console.log("\nStep 3: Deploying a new token");
        console.log("To deploy a new token, we need to:");
        console.log("1. Create a transaction in the MultiSigWallet");
        console.log("2. Get required signatures from voters");
        console.log("3. Execute the transaction\n");
        
        const tokenName = "wSN1";
        const deployData = tokenDeployer.interface.encodeFunctionData("deployToken", [tokenName]);
        
        console.log("Creating transaction in MultiSigWallet...");
        await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, deployData);
        console.log("Transaction created with ID: 0");
        
        await question("Press Enter to continue...");
        
        console.log("\nGetting signatures from voters...");
        await multisig.connect(voter1).signTransaction(0);
        await multisig.connect(voter2).signTransaction(0);
        console.log("Received signatures from Voter 1 and Voter 2");
        
        await question("Press Enter to continue...");
        
        console.log("\nExecuting transaction...");
        await multisig.connect(voter1).executeTransaction(0);
        
        const tokenAddress = await tokenDeployer.getTokenAddress(tokenName);
        console.log(`Token deployed successfully!`);
        console.log(`Token address: ${tokenAddress}`);
        console.log(`Token name: ${tokenName}`);
        
        await question("Press Enter to continue...");
        
        // Mint tokens
        console.log("\nStep 4: Minting tokens");
        console.log("To mint tokens, we need to:");
        console.log("1. Create a transaction in the MultiSigWallet");
        console.log("2. Get required signatures from voters");
        console.log("3. Execute the transaction\n");
        
        const amount = ethers.parseEther("100");
        const mintData = tokenDeployer.interface.encodeFunctionData("mintTokens", [tokenName, addr1.address, amount]);
        
        console.log("Creating mint transaction...");
        await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, mintData);
        console.log("Transaction created with ID: 1");
        
        await question("Press Enter to continue...");
        
        console.log("\nGetting signatures from voters...");
        await multisig.connect(voter1).signTransaction(1);
        await multisig.connect(voter2).signTransaction(1);
        console.log("Received signatures from Voter 1 and Voter 2");
        
        await question("Press Enter to continue...");
        
        console.log("\nExecuting transaction...");
        await multisig.connect(voter1).executeTransaction(1);
        
        const token = await ethers.getContractAt("WrappedToken", tokenAddress);
        console.log(`Tokens minted successfully!`);
        console.log(`Balance of ${addr1.address}: ${ethers.formatEther(await token.balanceOf(addr1.address))} ${tokenName}`);
        
        await question("Press Enter to continue...");
        
        // Burn tokens
        console.log("\nStep 5: Burning tokens");
        console.log("To burn tokens, we need to:");
        console.log("1. Create a transaction in the MultiSigWallet");
        console.log("2. Get required signatures from voters");
        console.log("3. Execute the transaction\n");
        
        const burnData = tokenDeployer.interface.encodeFunctionData("burnTokens", [tokenName, addr1.address, amount]);
        
        console.log("Creating burn transaction...");
        await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, burnData);
        console.log("Transaction created with ID: 2");
        
        await question("Press Enter to continue...");
        
        console.log("\nGetting signatures from voters...");
        await multisig.connect(voter1).signTransaction(2);
        await multisig.connect(voter2).signTransaction(2);
        console.log("Received signatures from Voter 1 and Voter 2");
        
        await question("Press Enter to continue...");
        
        console.log("\nExecuting transaction...");
        await multisig.connect(voter1).executeTransaction(2);
        
        console.log(`Tokens burned successfully!`);
        console.log(`Balance of ${addr1.address}: ${ethers.formatEther(await token.balanceOf(addr1.address))} ${tokenName}`);
        
        await question("Press Enter to continue...");
        
        // Demonstrate error cases
        console.log("\nStep 6: Demonstrating error cases");
        console.log("Let's try to mint tokens for a non-existent token...\n");
        
        const invalidMintData = tokenDeployer.interface.encodeFunctionData("mintTokens", ["NonExistentToken", addr1.address, amount]);
        
        console.log("Creating transaction for non-existent token...");
        await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, invalidMintData);
        console.log("Transaction created with ID: 3");
        
        await question("Press Enter to continue...");
        
        console.log("\nGetting signatures from voters...");
        await multisig.connect(voter1).signTransaction(3);
        await multisig.connect(voter2).signTransaction(3);
        console.log("Received signatures from Voter 1 and Voter 2");
        
        await question("Press Enter to continue...");
        
        console.log("\nExecuting transaction...");
        await expect(multisig.connect(voter1).executeTransaction(3))
            .to.be.revertedWithCustomError(multisig, "TransactionFailed");
        console.log("Transaction failed as expected because the token doesn't exist!");
        
        await question("Press Enter to continue...");
        
        console.log("\n=== Walkthrough Complete! ===");
        console.log("This demonstration showed how:");
        console.log("1. The MultiSigWallet requires multiple signatures for transactions");
        console.log("2. The TokenDeployer is owned by the MultiSigWallet");
        console.log("3. All token operations (deploy, mint, burn) go through the MultiSigWallet");
        console.log("4. Error cases are properly handled\n");
        
        rl.close();
        
    } catch (error) {
        console.error("\nError during walkthrough:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 