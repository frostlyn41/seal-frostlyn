const { ethers } = require("ethers");
require("colors");

// Configuration
const CONFIG = {
  RPC_URL: "https://testnet.dplabs-internal.com/",
  EXPLORER_URL: "https://testnet.pharosscan.xyz/tx/",
  CHAIN_ID: 688688,
  
  // Token Addresses
  TOKENS: {
    PHRS: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", // Special address for native token
    WPHRS: "0x76aaada469d23216be5f7c596fa25f282ff9b364",
    USDC: "0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37",
    USDT: "0xed59de2d7ad9c043442e381231ee3646fc3c2939"
  },
  
  SWAP_ROUTER: "0x1a4de519154ae51200b0ad7c90f7fac75547888a",
  FEE_TIER: 500,
  GAS_LIMIT: 300000, // Increased gas limit
  GAS_PRICE: ethers.parseUnits("1.5", "gwei") // Slightly higher gas price
};

// Enhanced ABI with more functions
const ABI = {
  ERC20: [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 value) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function deposit() payable",
    "function withdraw(uint256 wad)"
  ],
  
  SWAP_ROUTER: [
    {
      "inputs": [
        {
          "components": [
            {"internalType": "address","name": "tokenIn","type": "address"},
            {"internalType": "address","name": "tokenOut","type": "address"},
            {"internalType": "uint24","name": "fee","type": "uint24"},
            {"internalType": "address","name": "recipient","type": "address"},
            {"internalType": "uint256","name": "amountIn","type": "uint256"},
            {"internalType": "uint256","name": "amountOutMinimum","type": "uint256"},
            {"internalType": "uint160","name": "sqrtPriceLimitX96","type": "uint160"}
          ],
          "internalType": "struct IV3SwapRouter.ExactInputSingleParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "exactInputSingle",
      "outputs": [{"internalType": "uint256","name": "amountOut","type": "uint256"}],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {"internalType": "bytes","name": "path","type": "bytes"},
            {"internalType": "address","name": "recipient","type": "address"},
            {"internalType": "uint256","name": "amountIn","type": "uint256"},
            {"internalType": "uint256","name": "amountOutMinimum","type": "uint256"}
          ],
          "internalType": "struct IV3SwapRouter.ExactInputParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "exactInput",
      "outputs": [{"internalType": "uint256","name": "amountOut","type": "uint256"}],
      "stateMutability": "payable",
      "type": "function"
    }
  ]
};

class EnhancedTokenSwapper {
  constructor(privateKey, proxyUrl = null) {
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL, {
      chainId: CONFIG.CHAIN_ID,
      name: "Pharos Testnet",
      ...(proxyUrl ? { agent: new (require("https-proxy-agent")).HttpsProxyAgent(proxyUrl) } : {})
    });
    
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.router = new ethers.Contract(CONFIG.SWAP_ROUTER, ABI.SWAP_ROUTER, this.wallet);
  }

  async printBalances() {
    console.log("\n=== Current Balances ===".cyan.bold);
    
    const balances = {
      PHRS: await this.provider.getBalance(this.wallet.address),
      WPHRS: await this.getTokenBalance("WPHRS"),
      USDC: await this.getTokenBalance("USDC"),
      USDT: await this.getTokenBalance("USDT")
    };
    
    for (const [token, balance] of Object.entries(balances)) {
      console.log(`${token}:`.padEnd(10), `${ethers.formatEther(balance)}`.green);
    }
    
    console.log("=======================\n".cyan.bold);
    return balances;
  }

  async getTokenBalance(token) {
    if (token === "PHRS") return this.provider.getBalance(this.wallet.address);
    const contract = new ethers.Contract(CONFIG.TOKENS[token], ABI.ERC20, this.wallet);
    return contract.balanceOf(this.wallet.address);
  }

  async wrapPhrs(amount) {
    try {
      const wphrsContract = new ethers.Contract(CONFIG.TOKENS.WPHRS, ABI.ERC20, this.wallet);
      const amountWei = ethers.parseEther(amount.toString());
      
      console.log(`⏳ Wrapping ${amount} PHRS to WPHRS...`.yellow);
      
      const tx = await wphrsContract.deposit({
        value: amountWei,
        gasLimit: 50000,
        gasPrice: CONFIG.GAS_PRICE
      });
      
      await tx.wait();
      console.log(`✅ Successfully wrapped ${amount} PHRS to WPHRS!`.green);
      console.log(`Transaction: ${CONFIG.EXPLORER_URL}${tx.hash}\n`.blue.underline);
      
      return { success: true, txHash: tx.hash };
    } catch (error) {
      console.error(`❌ Error wrapping PHRS: ${error.message}`.red);
      return { success: false, error: error.message };
    }
  }

  async unwrapWphrs(amount) {
    try {
      const wphrsContract = new ethers.Contract(CONFIG.TOKENS.WPHRS, ABI.ERC20, this.wallet);
      const amountWei = ethers.parseEther(amount.toString());
      
      console.log(`⏳ Unwrapping ${amount} WPHRS to PHRS...`.yellow);
      
      const tx = await wphrsContract.withdraw(amountWei, {
        gasLimit: 50000,
        gasPrice: CONFIG.GAS_PRICE
      });
      
      await tx.wait();
      console.log(`✅ Successfully unwrapped ${amount} WPHRS to PHRS!`.green);
      console.log(`Transaction: ${CONFIG.EXPLORER_URL}${tx.hash}\n`.blue.underline);
      
      return { success: true, txHash: tx.hash };
    } catch (error) {
      console.error(`❌ Error unwrapping WPHRS: ${error.message}`.red);
      return { success: false, error: error.message };
    }
  }

  async swapTokens(fromToken, toToken, amount) {
    try {
      // Validate tokens
      if (!CONFIG.TOKENS[fromToken] && fromToken !== "PHRS") {
        throw new Error(`Invalid fromToken: ${fromToken}`);
      }
      if (!CONFIG.TOKENS[toToken] && toToken !== "PHRS") {
        throw new Error(`Invalid toToken: ${toToken}`);
      }

      const amountWei = ethers.parseEther(amount.toString());
      
      console.log(`⏳ Preparing to swap ${amount} ${fromToken} to ${toToken}...`.yellow);
      
      // Handle PHRS swaps differently (must be wrapped first)
      if (fromToken === "PHRS") {
        console.log(`⚠️  PHRS must be wrapped to WPHRS first for token swaps`.yellow);
        const wrapResult = await this.wrapPhrs(amount);
        if (!wrapResult.success) throw new Error("Wrapping failed");
        fromToken = "WPHRS";
      }

      // Handle approvals
      const tokenContract = new ethers.Contract(CONFIG.TOKENS[fromToken], ABI.ERC20, this.wallet);
      const allowance = await tokenContract.allowance(this.wallet.address, CONFIG.SWAP_ROUTER);
      
      if (allowance < amountWei) {
        console.log(`🔒 Approving ${fromToken} for swapping...`.cyan);
        const approveTx = await tokenContract.approve(CONFIG.SWAP_ROUTER, amountWei);
        await approveTx.wait();
        console.log(`✅ Approval successful!`.green);
      }

      // Prepare swap parameters
      const tokenIn = CONFIG.TOKENS[fromToken];
      const tokenOut = toToken === "PHRS" ? CONFIG.TOKENS.WPHRS : CONFIG.TOKENS[toToken];
      
      console.log(`🔄 Swapping ${amount} ${fromToken} to ${toToken}...`.yellow);
      
      // Use exactInput for better routing
      const path = ethers.solidityPacked(
        ["address", "uint24", "address"],
        [tokenIn, CONFIG.FEE_TIER, tokenOut]
      );
      
      const swapParams = {
        path,
        recipient: this.wallet.address,
        amountIn: amountWei,
        amountOutMinimum: 0
      };

      const tx = await this.router.exactInput(swapParams, {
        gasLimit: CONFIG.GAS_LIMIT,
        gasPrice: CONFIG.GAS_PRICE
      });
      
      await tx.wait();
      console.log(`✅ Successfully swapped ${amount} ${fromToken} to ${toToken}!`.green);
      console.log(`Transaction: ${CONFIG.EXPLORER_URL}${tx.hash}\n`.blue.underline);
      
      // If converting to PHRS, unwrap the WPHRS
      if (toToken === "PHRS") {
        await this.unwrapWphrs(amount);
      }
      
      return { success: true, txHash: tx.hash };
    } catch (error) {
      console.error(`❌ Swap failed: ${error.message}`.red);
      return { success: false, error: error.message };
    }
  }

  async executeSafeSwaps() {
    console.log("\n=== Pharos Enhanced Token Swapper ===".cyan.bold);
    console.log(`Wallet: ${this.wallet.address}\n`.gray);
    
    await this.printBalances();
    
    // Recommended swap sequence
    const operations = [
      { type: "wrap", amount: "0.01" },
      { type: "swap", from: "WPHRS", to: "USDC", amount: "0.005" },
      { type: "swap", from: "WPHRS", to: "USDT", amount: "0.005" },
      { type: "unwrap", amount: "0.005" }
    ];
    
    for (const op of operations) {
      try {
        switch (op.type) {
          case "wrap":
            await this.wrapPhrs(op.amount);
            break;
          case "unwrap":
            await this.unwrapWphrs(op.amount);
            break;
          case "swap":
            await this.swapTokens(op.from, op.to, op.amount);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5s delay between ops
        await this.printBalances();
      } catch (error) {
        console.error(`Operation failed: ${error.message}`.red);
        continue;
      }
    }
  }
}

// Main execution
(async () => {
  try {
    const privateKeys = require("fs").readFileSync("privateKeys.txt", "utf8").trim().split("\n");
    const proxies = require("fs").readFileSync("proxy.txt", "utf8").trim().split("\n");
    
    for (let i = 0; i < privateKeys.length; i++) {
      const privateKey = privateKeys[i].trim();
      const proxy = proxies[i] ? proxies[i].trim() : null;
      
      console.log(`\n=== Processing Wallet ${i+1} ===`.magenta.bold);
      const swapper = new EnhancedTokenSwapper(privateKey, proxy);
      await swapper.executeSafeSwaps();
      
      if (i < privateKeys.length - 1) {
        const delay = Math.floor(Math.random() * 15) + 10; // 10-25 sec delay
        console.log(`Waiting ${delay} seconds before next wallet...`.gray);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
      }
    }
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`.red);
    process.exit(1);
  }
})();
