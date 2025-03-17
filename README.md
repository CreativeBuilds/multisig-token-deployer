# ERC20 Token Deployer with MultiSig Control

A secure system for deploying and managing ERC20 tokens through a multisig wallet. This project implements a role-based access control system where token operations require multiple signatures for execution.

## Features

- **MultiSigWallet**: A secure wallet that requires multiple signatures to execute transactions
- **TokenDeployer**: A contract that manages token deployment and operations
- **WrappedToken**: An ERC20 token implementation with controlled minting and burning
- **Role-Based Access Control**: Secure permission management using OpenZeppelin's AccessControl
- **Interactive Walkthrough**: A script to demonstrate the system's functionality

## Prerequisites

- Node.js (v18.x or v20.x recommended)
- npm or yarn
- Hardhat

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/erc20-deployer.git
cd erc20-deployer
```

2. Install dependencies:
```bash
npm install
```

## Project Structure

```
erc20-deployer/
├── contracts/
│   ├── MultiSigWallet.sol    # Multisig wallet implementation
│   └── TokenDeployer.sol     # Token deployment and management
├── scripts/
│   └── walkthrough.js        # Interactive demonstration script
├── test/
│   ├── MultiSigWallet.test.js
│   └── TokenDeployer.test.js
└── hardhat.config.js         # Hardhat configuration
```

## Usage

### Running Tests

```bash
npx hardhat test
```

### Interactive Walkthrough

1. Start a local Hardhat network in one terminal:
```bash
npx hardhat node
```

2. Run the walkthrough script in another terminal:
```bash
npx hardhat run scripts/walkthrough.js --network localhost
```

## Contract Details

### MultiSigWallet

- Requires multiple signatures to execute transactions
- Implements role-based access control
- Supports adding/removing voters
- Configurable required signature count

### TokenDeployer

- Owned by the MultiSigWallet
- Manages token deployment and operations
- Provides wrapper functions for minting and burning
- Maintains token name-to-address mappings

### WrappedToken

- Standard ERC20 implementation
- Controlled minting and burning capabilities
- Role-based access control for operations

## Security Features

- Multi-signature requirement for all operations
- Role-based access control
- Reentrancy protection
- Input validation
- Custom error handling

## Development

### Adding New Features

1. Create a new branch:
```bash
git checkout -b feature/your-feature
```

2. Make your changes and commit:
```bash
git commit -m "feat: your feature description"
```

3. Push and create a pull request:
```bash
git push origin feature/your-feature
```

### Testing

- Write tests for new features
- Ensure all tests pass
- Maintain test coverage

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
