const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
    let MultiSigWallet;
    let multisig;
    let deployer;
    let voter1;
    let voter2;
    let voter3;
    let addr1;
    let addr2;
    
    beforeEach(async function () {
        [deployer, voter1, voter2, voter3, addr1, addr2] = await ethers.getSigners();
        MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
        multisig = await MultiSigWallet.deploy([voter1.address, voter2.address, voter3.address], 2);
        await multisig.waitForDeployment();
    });
    
    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            expect(await multisig.hasRole(await multisig.OWNER_ROLE(), deployer.address)).to.be.true;
        });
        
        it("Should set the correct voters", async function () {
            expect(await multisig.hasRole(await multisig.VOTER_ROLE(), voter1.address)).to.be.true;
            expect(await multisig.hasRole(await multisig.VOTER_ROLE(), voter2.address)).to.be.true;
            expect(await multisig.hasRole(await multisig.VOTER_ROLE(), voter3.address)).to.be.true;
        });
        
        it("Should set the correct required signatures", async function () {
            expect(await multisig.requiredSignatures()).to.equal(2);
        });
        
        it("Should not deploy with no voters", async function () {
            await expect(MultiSigWallet.deploy([], 1))
                .to.be.revertedWithCustomError(multisig, "NoVotersProvided");
        });
        
        it("Should not deploy with invalid required signatures", async function () {
            await expect(MultiSigWallet.deploy([voter1.address], 2))
                .to.be.revertedWithCustomError(multisig, "InvalidRequiredSignatures");
        });
    });
    
    describe("Transaction Management", function () {
        it("Should create a transaction", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            const tx = await multisig.connect(deployer).createTransaction(addr1.address, value, data);
            const receipt = await tx.wait();
            
            expect(receipt.logs[0].args.txId).to.equal(0);
            expect(receipt.logs[0].args.to).to.equal(addr1.address);
            expect(receipt.logs[0].args.value).to.equal(value);
        });
        
        it("Should allow signing a transaction", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multisig.connect(deployer).createTransaction(addr1.address, value, data);
            
            const tx = await multisig.connect(voter2).signTransaction(0);
            const receipt = await tx.wait();
            
            expect(receipt.logs[0].args.txId).to.equal(0);
            expect(receipt.logs[0].args.signer).to.equal(voter2.address);
        });
        
        it("Should not allow signing twice", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multisig.connect(deployer).createTransaction(addr1.address, value, data);
            await multisig.connect(voter1).signTransaction(0);
            
            await expect(multisig.connect(voter1).signTransaction(0))
                .to.be.revertedWithCustomError(multisig, "AlreadySigned");
        });
        
        it("Should execute transaction with enough signatures", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multisig.connect(deployer).createTransaction(addr1.address, value, data);
            await multisig.connect(voter1).signTransaction(0);
            await multisig.connect(voter2).signTransaction(0);
            
            await deployer.sendTransaction({
                to: await multisig.getAddress(),
                value: ethers.parseEther("0.2")
            });
            
            const tx = await multisig.connect(voter1).executeTransaction(0);
            const receipt = await tx.wait();
            
            expect(receipt.logs[0].args.txId).to.equal(0);
        });
        
        it("Should not execute transaction without enough signatures", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multisig.connect(deployer).createTransaction(addr1.address, value, data);
            await multisig.connect(voter1).signTransaction(0);
            
            await expect(multisig.connect(voter1).executeTransaction(0))
                .to.be.revertedWithCustomError(multisig, "NotEnoughSignatures");
        });
    });
    
    describe("Voter Management", function () {
        it("Should add new voter", async function () {
            await multisig.connect(deployer).addVoter(addr1.address);
            expect(await multisig.hasRole(await multisig.VOTER_ROLE(), addr1.address)).to.be.true;
        });
        
        it("Should remove voter", async function () {
            await multisig.connect(deployer).removeVoter(voter3.address);
            expect(await multisig.hasRole(await multisig.VOTER_ROLE(), voter3.address)).to.be.false;
        });
        
        it("Should not add existing voter", async function () {
            await expect(multisig.connect(deployer).addVoter(voter1.address))
                .to.be.revertedWithCustomError(multisig, "AlreadyVoter");
        });
        
        it("Should not remove non-voter", async function () {
            await expect(multisig.connect(deployer).removeVoter(addr1.address))
                .to.be.revertedWithCustomError(multisig, "NotVoter");
        });
        
        it("Should update required signatures", async function () {
            await multisig.connect(deployer).updateRequiredSignatures(3);
            expect(await multisig.requiredSignatures()).to.equal(3);
        });
        
        it("Should not update required signatures to zero", async function () {
            await expect(multisig.connect(deployer).updateRequiredSignatures(0))
                .to.be.revertedWithCustomError(multisig, "InvalidRequiredSignaturesCount");
        });
    });
    
    describe("Access Control", function () {
        it("Should not allow non-owners to create transactions", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await expect(multisig.connect(addr1).createTransaction(addr2.address, value, data))
                .to.be.reverted;
        });
        
        it("Should not allow non-voters to sign transactions", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multisig.connect(deployer).createTransaction(addr1.address, value, data);
            
            await expect(multisig.connect(addr1).signTransaction(0))
                .to.be.reverted;
        });
        
        it("Should not allow non-voters to execute transactions", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multisig.connect(deployer).createTransaction(addr1.address, value, data);
            await multisig.connect(voter1).signTransaction(0);
            await multisig.connect(voter2).signTransaction(0);
            
            await expect(multisig.connect(addr1).executeTransaction(0))
                .to.be.reverted;
        });
    });
}); 