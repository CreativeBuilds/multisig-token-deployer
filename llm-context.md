# ERC20 Token Deployer - LLM Context

## Project Overview
This is a secure system for deploying and managing ERC20 tokens through a multisig wallet. The system implements role-based access control and requires multiple signatures for all operations.

## Architecture

### Core Contracts
1. **MultiSigWallet.sol**
   - Manages transaction execution requiring multiple signatures
   - Implements OpenZeppelin's AccessControl
   - Roles: OWNER_ROLE, VOTER_ROLE, EXECUTOR_ROLE
   - Handles transaction queuing and execution

2. **TokenDeployer.sol**
   - Owned by MultiSigWallet
   - Manages token deployment and operations
   - Provides wrapper functions for minting/burning
   - Maintains token registry

3. **WrappedToken.sol**
   - ERC20 implementation with controlled minting/burning
   - Uses OpenZeppelin's AccessControl
   - Roles: MINTER_ROLE, BURNER_ROLE

## Coding Standards

### Function Return Values
- All functions should return values in the format: `[value, err]` or `[value1, value2, err]`
- Error should always be the last return value
- Example:
```solidity
function someFunction() public returns (uint256, error) {
    if (condition) return [0, CustomError()];
    return [result, nil];
}
```

### Control Flow
- Avoid using `else` with `if` statements
- Use early returns with single-line statements when possible
- Use switch cases for multiple conditions
- Example:
```solidity
if (condition) return [0, CustomError()];
// continue with logic
```

### Error Handling
- Use custom errors for better gas efficiency
- Include descriptive error messages
- Example:
```solidity
error InvalidAmount(uint256 amount);
error Unauthorized(address caller);
```

### Security Considerations
- Implement reentrancy guards where necessary
- Use OpenZeppelin's AccessControl for role management
- Validate all inputs
- Use SafeMath for arithmetic operations
- Implement proper access controls

### Testing Standards
- Write comprehensive tests for all functions
- Include both positive and negative test cases
- Test edge cases and error conditions
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Documentation
- Include NatSpec comments for all public functions
- Document complex logic with inline comments
- Keep comments up to date with code changes
- Example:
```solidity
/// @notice Mints new tokens
/// @param to Address to receive the tokens
/// @param amount Amount of tokens to mint
/// @return success Whether the operation was successful
/// @return err Any error that occurred
function mint(address to, uint256 amount) public returns (bool, error) {
    // implementation
}
```

## Development Workflow
1. Create feature branch
2. Implement changes following coding standards
3. Write/update tests
4. Run test suite
5. Create pull request
6. Address review comments
7. Merge after approval

## Dependencies
- OpenZeppelin Contracts
- Hardhat
- Chai for testing
- Ethers.js for interaction

## Network Configuration
- Local development: Hardhat network
- Testnet: Sepolia
- Mainnet: Ethereum

## Common Operations
1. Deploying contracts
2. Creating transactions
3. Collecting signatures
4. Executing transactions
5. Managing roles
6. Minting/burning tokens

## Error Handling Patterns
1. Custom errors for contract-specific issues
2. Revert with messages for general errors
3. Return error values for recoverable issues
4. Events for important state changes 