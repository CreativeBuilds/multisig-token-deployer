const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenDeployer", function () {
    let MultiSigWallet;
    let TokenDeployer;
    let multisig;
    let tokenDeployer;
    let deployer;
    let voter1;
    let voter2;
    let voter3;
    let addr1;
    
    beforeEach(async function () {
        [deployer, voter1, voter2, voter3, addr1] = await ethers.getSigners();
        
        MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
        multisig = await MultiSigWallet.deploy([voter1.address, voter2.address, voter3.address], 2);
        await multisig.waitForDeployment();
        
        TokenDeployer = await ethers.getContractFactory("TokenDeployer");
        tokenDeployer = await TokenDeployer.deploy(await multisig.getAddress());
        await tokenDeployer.waitForDeployment();
    });
    
    describe("Deployment", function () {
        it("Should set the correct multisig owner", async function () {
            expect(await tokenDeployer.owner()).to.equal(await multisig.getAddress());
        });
    });
    
    describe("Token Deployment", function () {
        it("Should deploy a new token", async function () {
            const tokenName = "wSN1";
            const data = tokenDeployer.interface.encodeFunctionData("deployToken", [tokenName]);
            
            // Create transaction
            await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, data);
            
            // Sign transaction
            await multisig.connect(voter1).signTransaction(0);
            await multisig.connect(voter2).signTransaction(0);
            
            // Execute transaction
            await multisig.connect(voter1).executeTransaction(0);
            
            const tokenAddress = await tokenDeployer.getTokenAddress(tokenName);
            expect(tokenAddress).to.not.equal(ethers.ZeroAddress);
            
            const token = await ethers.getContractAt("WrappedToken", tokenAddress);
            expect(await token.name()).to.equal(tokenName);
            expect(await token.symbol()).to.equal(tokenName);
            
            // Verify multisig has minting and burning roles
            expect(await token.hasRole(await token.MINTER_ROLE(), await multisig.getAddress())).to.be.true;
            expect(await token.hasRole(await token.BURNER_ROLE(), await multisig.getAddress())).to.be.true;
        });
        
        it("Should not allow deploying token with same name", async function () {
            const tokenName = "wSN1";
            const data = tokenDeployer.interface.encodeFunctionData("deployToken", [tokenName]);
            
            // Deploy first token
            await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, data);
            await multisig.connect(voter1).signTransaction(0);
            await multisig.connect(voter2).signTransaction(0);
            await multisig.connect(voter1).executeTransaction(0);
            
            // Try to deploy second token with same name
            await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, data);
            await multisig.connect(voter1).signTransaction(1);
            await multisig.connect(voter2).signTransaction(1);
            
            // Fund the multisig wallet with ETH for deployment
            await deployer.sendTransaction({
                to: await multisig.getAddress(),
                value: ethers.parseEther("0.1")
            });
            
            await expect(multisig.connect(voter1).executeTransaction(1))
                .to.be.revertedWithCustomError(multisig, "TransactionFailed");
        });
    });
    
    describe("Token Operations", function () {
        let token;
        let tokenAddress;
        let tokenName;
        
        beforeEach(async function () {
            tokenName = "wSN1";
            const data = tokenDeployer.interface.encodeFunctionData("deployToken", [tokenName]);
            
            await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, data);
            await multisig.connect(voter1).signTransaction(0);
            await multisig.connect(voter2).signTransaction(0);
            await multisig.connect(voter1).executeTransaction(0);
            
            tokenAddress = await tokenDeployer.getTokenAddress(tokenName);
            token = await ethers.getContractAt("WrappedToken", tokenAddress);
        });
        
        it("Should allow multisig to mint tokens through wrapper", async function () {
            const amount = ethers.parseEther("100");
            const mintData = tokenDeployer.interface.encodeFunctionData("mintTokens", [tokenName, addr1.address, amount]);
            
            await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, mintData);
            await multisig.connect(voter1).signTransaction(1);
            await multisig.connect(voter2).signTransaction(1);
            await multisig.connect(voter1).executeTransaction(1);
            
            expect(await token.balanceOf(addr1.address)).to.equal(amount);
        });
        
        it("Should allow multisig to burn tokens through wrapper", async function () {
            const amount = ethers.parseEther("100");
            const mintData = tokenDeployer.interface.encodeFunctionData("mintTokens", [tokenName, addr1.address, amount]);
            
            // First mint some tokens
            await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, mintData);
            await multisig.connect(voter1).signTransaction(1);
            await multisig.connect(voter2).signTransaction(1);
            await multisig.connect(voter1).executeTransaction(1);
            
            // Then burn them
            const burnData = tokenDeployer.interface.encodeFunctionData("burnTokens", [tokenName, addr1.address, amount]);
            await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, burnData);
            await multisig.connect(voter1).signTransaction(2);
            await multisig.connect(voter2).signTransaction(2);
            await multisig.connect(voter1).executeTransaction(2);
            
            expect(await token.balanceOf(addr1.address)).to.equal(0);
        });
        
        it("Should not allow non-multisig to mint tokens through wrapper", async function () {
            const amount = ethers.parseEther("100");
            await expect(tokenDeployer.connect(addr1).mintTokens(tokenName, addr1.address, amount))
                .to.be.revertedWith("Only multisig can call");
        });
        
        it("Should not allow non-multisig to burn tokens through wrapper", async function () {
            const amount = ethers.parseEther("100");
            await expect(tokenDeployer.connect(addr1).burnTokens(tokenName, addr1.address, amount))
                .to.be.revertedWith("Only multisig can call");
        });
        
        it("Should not allow minting for non-existent token", async function () {
            const amount = ethers.parseEther("100");
            const mintData = tokenDeployer.interface.encodeFunctionData("mintTokens", ["NonExistentToken", addr1.address, amount]);
            
            await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, mintData);
            await multisig.connect(voter1).signTransaction(1);
            await multisig.connect(voter2).signTransaction(1);
            
            // Fund the multisig wallet with ETH for deployment
            await deployer.sendTransaction({
                to: await multisig.getAddress(),
                value: ethers.parseEther("0.1")
            });
            
            await expect(multisig.connect(voter1).executeTransaction(1))
                .to.be.revertedWithCustomError(multisig, "TransactionFailed");
        });
        
        it("Should not allow burning for non-existent token", async function () {
            const amount = ethers.parseEther("100");
            const burnData = tokenDeployer.interface.encodeFunctionData("burnTokens", ["NonExistentToken", addr1.address, amount]);
            
            await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, burnData);
            await multisig.connect(voter1).signTransaction(1);
            await multisig.connect(voter2).signTransaction(1);
            
            // Fund the multisig wallet with ETH for deployment
            await deployer.sendTransaction({
                to: await multisig.getAddress(),
                value: ethers.parseEther("0.1")
            });
            
            await expect(multisig.connect(voter1).executeTransaction(1))
                .to.be.revertedWithCustomError(multisig, "TransactionFailed");
        });
    });
    
    describe("Token Lookup", function () {
        it("Should correctly map token address to name", async function () {
            const tokenName = "wSN1";
            const data = tokenDeployer.interface.encodeFunctionData("deployToken", [tokenName]);
            
            // Fund the multisig wallet with ETH for deployment
            await deployer.sendTransaction({
                to: await multisig.getAddress(),
                value: ethers.parseEther("0.1")
            });
            
            await multisig.connect(deployer).createTransaction(await tokenDeployer.getAddress(), 0, data);
            await multisig.connect(voter1).signTransaction(0);
            await multisig.connect(voter2).signTransaction(0);
            await multisig.connect(voter1).executeTransaction(0);
            
            const tokenAddress = await tokenDeployer.getTokenAddress(tokenName);
            expect(await tokenDeployer.getTokenName(tokenAddress)).to.equal(tokenName);
        });
        
        it("Should return empty string for non-existent token address", async function () {
            expect(await tokenDeployer.getTokenName(addr1.address)).to.equal("");
        });
        
        it("Should return zero address for non-existent token name", async function () {
            expect(await tokenDeployer.getTokenAddress("NonExistentToken")).to.equal(ethers.ZeroAddress);
        });
    });
}); 