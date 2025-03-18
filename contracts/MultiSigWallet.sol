// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MultiSigWallet is AccessControl, ReentrancyGuard {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant VOTER_ROLE = keccak256("VOTER_ROLE");
    
    uint256 public requiredSignatures;
    uint256 public transactionCount;
    uint256 public batchCount;
    
    // Input struct for creating transactions
    struct TransactionInput {
        address to;
        uint256 value;
        bytes data;
    }
    
    // Storage struct for tracking transaction state
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 signatureCount;
    }
    
    // Storage struct for batch transactions
    struct BatchedTransaction {
        Transaction[] transactions;
        bool executed;
        uint256 signatureCount;
        uint256 totalValue;  // Track total value of all transactions
    }
    
    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public signatures;
    mapping(uint256 => BatchedTransaction) public batchedTransactions;
    mapping(uint256 => mapping(address => bool)) public batchSignatures;
    
    event TransactionCreated(uint256 indexed txId, address indexed to, uint256 value, bytes data);
    event TransactionSigned(uint256 indexed txId, address indexed signer);
    event TransactionExecuted(uint256 indexed txId);
    event BatchCreated(uint256 indexed batchId, uint256 transactionCount);
    event BatchSigned(uint256 indexed batchId, address indexed signer);
    event BatchExecuted(uint256 indexed batchId);
    event BatchTransactionFailed(uint256 indexed batchId, uint256 indexed transactionIndex);
    
    error NoVotersProvided();
    error InvalidRequiredSignatures();
    error TransactionAlreadyExecuted();
    error AlreadySigned();
    error NotEnoughSignatures();
    error TransactionFailed();
    error AlreadyVoter();
    error NotVoter();
    error InvalidRequiredSignaturesCount();
    error EmptyBatch();
    error BatchAlreadyExecuted();
    error BatchNotEnoughSignatures();
    error InsufficientFunds();
    
    constructor(address[] memory _voters, uint256 _requiredSignatures) payable {
        if (_voters.length == 0) revert NoVotersProvided();
        if (_requiredSignatures == 0 || _requiredSignatures > _voters.length) revert InvalidRequiredSignatures();
        
        // Grant owner role to deployer
        _grantRole(OWNER_ROLE, msg.sender);
        
        // Grant voter role to all voters
        for (uint256 i = 0; i < _voters.length; i++) {
            _grantRole(VOTER_ROLE, _voters[i]);
        }
        
        requiredSignatures = _requiredSignatures;
    }
    
    function createTransaction(address _to, uint256 _value, bytes memory _data) 
        external 
        onlyRole(OWNER_ROLE) 
        returns (uint256) 
    {
        uint256 txId = transactionCount++;
        transactions[txId] = Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false,
            signatureCount: 0
        });
        
        emit TransactionCreated(txId, _to, _value, _data);
        return txId;
    }
    
    function signTransaction(uint256 _txId) external onlyRole(VOTER_ROLE) {
        if (transactions[_txId].executed) revert TransactionAlreadyExecuted();
        if (signatures[_txId][msg.sender]) revert AlreadySigned();
        
        signatures[_txId][msg.sender] = true;
        transactions[_txId].signatureCount++;
        
        emit TransactionSigned(_txId, msg.sender);
    }
    
    function executeTransaction(uint256 _txId) external nonReentrant onlyRole(VOTER_ROLE) {
        Transaction storage transaction = transactions[_txId];
        if (transaction.executed) revert TransactionAlreadyExecuted();
        if (transaction.signatureCount < requiredSignatures) revert NotEnoughSignatures();
        
        transaction.executed = true;
        
        (bool success, ) = transaction.to.call{value: transaction.value}(transaction.data);
        if (!success) revert TransactionFailed();
        
        emit TransactionExecuted(_txId);
    }
    
    function addVoter(address _newVoter) external onlyRole(OWNER_ROLE) {
        if (hasRole(VOTER_ROLE, _newVoter)) revert AlreadyVoter();
        _grantRole(VOTER_ROLE, _newVoter);
    }
    
    function removeVoter(address _voter) external onlyRole(OWNER_ROLE) {
        if (!hasRole(VOTER_ROLE, _voter)) revert NotVoter();
        _revokeRole(VOTER_ROLE, _voter);
    }
    
    function updateRequiredSignatures(uint256 _newRequired) external onlyRole(OWNER_ROLE) {
        if (_newRequired == 0) revert InvalidRequiredSignaturesCount();
        requiredSignatures = _newRequired;
    }
    
    function createBatchTransaction(TransactionInput[] calldata _transactions) 
        external 
        onlyRole(OWNER_ROLE) 
        returns (uint256) 
    {
        if (_transactions.length == 0) revert EmptyBatch();
        
        uint256 batchId = batchCount++;
        BatchedTransaction storage batch = batchedTransactions[batchId];
        
        uint256 totalValue;
        for (uint256 i = 0; i < _transactions.length; i++) {
            totalValue += _transactions[i].value;
            batch.transactions.push(Transaction({
                to: _transactions[i].to,
                value: _transactions[i].value,
                data: _transactions[i].data,
                executed: false,
                signatureCount: 0
            }));
        }
        batch.totalValue = totalValue;
        
        emit BatchCreated(batchId, _transactions.length);
        return batchId;
    }
    
    function signBatchTransaction(uint256 _batchId) external onlyRole(VOTER_ROLE) {
        BatchedTransaction storage batch = batchedTransactions[_batchId];
        if (batch.executed) revert BatchAlreadyExecuted();
        if (batchSignatures[_batchId][msg.sender]) revert AlreadySigned();
        
        batchSignatures[_batchId][msg.sender] = true;
        batch.signatureCount++;
        
        emit BatchSigned(_batchId, msg.sender);
    }
    
    function executeBatchTransaction(uint256 _batchId) external nonReentrant onlyRole(VOTER_ROLE) {
        BatchedTransaction storage batch = batchedTransactions[_batchId];
        if (batch.executed) revert BatchAlreadyExecuted();
        if (batch.signatureCount < requiredSignatures) revert BatchNotEnoughSignatures();
        if (address(this).balance < batch.totalValue) revert InsufficientFunds();
        
        batch.executed = true;
        
        for (uint256 i = 0; i < batch.transactions.length; i++) {
            Transaction storage transaction = batch.transactions[i];
            (bool success, ) = transaction.to.call{value: transaction.value}(transaction.data);
            if (!success) {
                emit BatchTransactionFailed(_batchId, i);
                revert TransactionFailed();
            }
            transaction.executed = true;
        }
        
        emit BatchExecuted(_batchId);
    }
    
    function getBatchTransaction(uint256 _batchId) external view returns (Transaction[] memory) {
        return batchedTransactions[_batchId].transactions;
    }
    
    function getBatchStatus(uint256 _batchId) external view returns (bool executed, uint256 signatureCount) {
        BatchedTransaction storage batch = batchedTransactions[_batchId];
        return (batch.executed, batch.signatureCount);
    }
    
    function hasSignedBatch(uint256 _batchId, address _signer) external view returns (bool) {
        return batchSignatures[_batchId][_signer];
    }
    
    receive() external payable {}
} 