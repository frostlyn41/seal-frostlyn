require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');
const randomUseragent = require('random-useragent');
const axios = require('axios');
const colors = require('colors');
const { table } = require('table');

// Configuration
const CONFIG = {
  RPC_URL: "https://testnet.dplabs-internal.com/",
  EXPLORER_URL: "https://testnet.pharosscan.xyz/tx/",
  CHAIN_ID: 688688,
  
  // Token Addresses
  TOKENS: {
    PHRS: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    WPHRS: "0x76aaada469d23216be5f7c596fa25f282ff9b364",
    USDC: "0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37",
    USDT: "0xed59de2d7ad9c043442e381231ee3646fc3c2939"
  },
  
  SWAP_ROUTER: "0x1a4de519154ae51200b0ad7c90f7fac75547888a",
  FEE_TIER: 500,
  GAS_LIMIT: 300000,
  GAS_PRICE: ethers.parseUnits("1.5", "gwei"),
  TRANSFER_COUNT: 10,
  TRANSFER_AMOUNT: "0.000001",
  SWAP_AMOUNTS: {
    PHRS_TO_STABLE: "0.01",
    STABLE_TO_PHRS: "0.005"
  }
};

// ABI definitions remain the same as your original
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

const tokenDecimals = {
  WPHRS: 18,
  USDC: 6,
  USDT: 6
};

// Enhanced Logger with proxy tracking
class WalletLogger {
  constructor(walletAddress = "SYSTEM", proxy = null) {
    this.walletAddress = walletAddress;
    this.proxy = proxy;
    this.shortAddress = walletAddress === "SYSTEM" ? "SYSTEM" : 
      `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    this.proxyInfo = proxy ? 
      `[Proxy: ${proxy.split('@').slice(-1)[0].split(':')[0]}]` : 
      '[Direct Connection]';
  }

  log(message, type = 'info', extra = '') {
    const timestamp = new Date().toLocaleTimeString();
    const prefixMap = {
      info: colors.green('✓'),
      wallet: colors.yellow('➤'),
      warn: colors.yellow('!'),
      error: colors.red('✗'),
      success: colors.green('+'),
      loading: colors.cyan('⟳'),
      step: colors.white('➤')
    };
    
    console.log(
      `${colors.gray(timestamp)} ${prefixMap[type]} ${colors.cyan(this.shortAddress)} ` +
      `${colors.magenta(this.proxyInfo)} ${message} ${extra}`
    );
  }

  banner(message) {
    console.log(colors.cyan.bold(`\n=== ${message} ===\n`));
  }

  separator() {
    console.log(colors.gray('-'.repeat(80)));
  }

  showProxyAssignment(wallets) {
    const data = [
      [colors.bold('Wallet #'), colors.bold('Address'), colors.bold('Proxy')]
    ];
    
    wallets.forEach((wallet, index) => {
      data.push([
        colors.bold(index + 1),
        wallet.address,
        wallet.proxy ? colors.green(wallet.proxy.split('@').slice(-1)[0]) : colors.yellow('Direct')
      ]);
    });

    console.log(table(data, {
      border: {
        topBody: `─`,
        topJoin: `┬`,
        topLeft: `┌`,
        topRight: `┐`,

        bottomBody: `─`,
        bottomJoin: `┴`,
        bottomLeft: `└`,
        bottomRight: `┘`,

        bodyLeft: `│`,
        bodyRight: `│`,
        bodyJoin: `│`,

        joinBody: `─`,
        joinLeft: `├`,
        joinRight: `┤`,
        joinJoin: `┼`
      },
      columns: {
        0: { alignment: 'center' },
        1: { width: 42 },
        2: { width: 30 }
      }
    }));
  }
}

// Enhanced Token Swapper with better logging
class EnhancedTokenSwapper {
  constructor(privateKey, proxyUrl = null) {
    this.provider = this.setupProvider(proxyUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.router = new ethers.Contract(CONFIG.SWAP_ROUTER, ABI.SWAP_ROUTER, this.wallet);
    this.logger = new WalletLogger(this.wallet.address, proxyUrl);
  }

  setupProvider(proxy = null) {
    if (proxy) {
      const agent = new HttpsProxyAgent(proxy);
      return new ethers.JsonRpcProvider(CONFIG.RPC_URL, {
        chainId: CONFIG.CHAIN_ID,
        name: "Pharos Testnet",
      }, {
        fetchOptions: { agent },
        headers: { 'User-Agent': randomUseragent.getRandom() },
      });
    }
    return new ethers.JsonRpcProvider(CONFIG.RPC_URL, {
      chainId: CONFIG.CHAIN_ID,
      name: "Pharos Testnet",
    });
  }

  async printBalances() {
    this.logger.banner('Current Balances');
    
    const balances = {
      PHRS: await this.provider.getBalance(this.wallet.address),
      WPHRS: await this.getTokenBalance("WPHRS"),
      USDC: await this.getTokenBalance("USDC"),
      USDT: await this.getTokenBalance("USDT")
    };
    
    const balanceData = [
      [colors.bold('Token'), colors.bold('Balance')],
      ['PHRS', colors.green(ethers.formatEther(balances.PHRS))],
      ['WPHRS', colors.green(ethers.formatEther(balances.WPHRS))],
      ['USDC', colors.green(ethers.formatUnits(balances.USDC, 6))],
      ['USDT', colors.green(ethers.formatUnits(balances.USDT, 6))]
    ];
    
    console.log(table(balanceData));
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
      
      this.logger.log(`Wrapping ${amount} PHRS to WPHRS...`, 'loading');
      
      const tx = await wphrsContract.deposit({
        value: amountWei,
        gasLimit: 50000,
        gasPrice: CONFIG.GAS_PRICE
      });
      
      await tx.wait();
      this.logger.log(`Successfully wrapped ${amount} PHRS to WPHRS!`, 'success');
      this.logger.log(`Transaction: ${CONFIG.EXPLORER_URL}${tx.hash}`, 'info');
      
      return { success: true, txHash: tx.hash };
    } catch (error) {
      this.logger.log(`Error wrapping PHRS: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async unwrapWphrs(amount) {
    try {
      const wphrsContract = new ethers.Contract(CONFIG.TOKENS.WPHRS, ABI.ERC20, this.wallet);
      const amountWei = ethers.parseEther(amount.toString());
      
      this.logger.log(`Unwrapping ${amount} WPHRS to PHRS...`, 'loading');
      
      const tx = await wphrsContract.withdraw(amountWei, {
        gasLimit: 50000,
        gasPrice: CONFIG.GAS_PRICE
      });
      
      await tx.wait();
      this.logger.log(`Successfully unwrapped ${amount} WPHRS to PHRS!`, 'success');
      this.logger.log(`Transaction: ${CONFIG.EXPLORER_URL}${tx.hash}`, 'info');
      
      return { success: true, txHash: tx.hash };
    } catch (error) {
      this.logger.log(`Error unwrapping WPHRS: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async swapTokens(fromToken, toToken, amount) {
    try {
      if (!CONFIG.TOKENS[fromToken] && fromToken !== "PHRS") {
        throw new Error(`Invalid fromToken: ${fromToken}`);
      }
      if (!CONFIG.TOKENS[toToken] && toToken !== "PHRS") {
        throw new Error(`Invalid toToken: ${toToken}`);
      }

      const amountWei = fromToken === "PHRS" ? 
        ethers.parseEther(amount.toString()) : 
        ethers.parseUnits(amount.toString(), tokenDecimals[fromToken]);
      
      this.logger.log(`Preparing to swap ${amount} ${fromToken} → ${toToken}...`, 'loading');
      
      if (fromToken === "PHRS") {
        this.logger.log(`PHRS must be wrapped to WPHRS first`, 'warn');
        const wrapResult = await this.wrapPhrs(amount);
        if (!wrapResult.success) throw new Error("Wrapping failed");
        fromToken = "WPHRS";
      }

      const tokenContract = new ethers.Contract(CONFIG.TOKENS[fromToken], ABI.ERC20, this.wallet);
      const allowance = await tokenContract.allowance(this.wallet.address, CONFIG.SWAP_ROUTER);
      
      if (allowance < amountWei) {
        this.logger.log(`Approving ${fromToken} for swapping...`, 'step');
        const approveTx = await tokenContract.approve(CONFIG.SWAP_ROUTER, amountWei);
        await approveTx.wait();
        this.logger.log(`Approval successful!`, 'success');
      }

      const tokenIn = CONFIG.TOKENS[fromToken];
      const tokenOut = toToken === "PHRS" ? CONFIG.TOKENS.WPHRS : CONFIG.TOKENS[toToken];
      
      this.logger.log(`Swapping ${amount} ${fromToken} → ${toToken}...`, 'loading');
      
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
      this.logger.log(`Successfully swapped ${amount} ${fromToken} → ${toToken}!`, 'success');
      this.logger.log(`Transaction: ${CONFIG.EXPLORER_URL}${tx.hash}`, 'info');
      
      if (toToken === "PHRS") {
        await this.unwrapWphrs(amount);
      }
      
      return { success: true, txHash: tx.hash };
    } catch (error) {
      this.logger.log(`Swap failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async transferPHRS(amount) {
    try {
      const randomWallet = ethers.Wallet.createRandom();
      const toAddress = randomWallet.address;
      this.logger.log(`Preparing to transfer ${amount} PHRS to ${toAddress}...`, 'loading');

      const balance = await this.provider.getBalance(this.wallet.address);
      const amountWei = ethers.parseEther(amount.toString());

      if (balance < amountWei) {
        throw new Error(`Insufficient PHRS balance: ${ethers.formatEther(balance)} < ${amount}`);
      }

      const tx = await this.wallet.sendTransaction({
        to: toAddress,
        value: amountWei,
        gasLimit: 21000,
        gasPrice: CONFIG.GAS_PRICE
      });

      await tx.wait();
      this.logger.log(`Successfully transferred ${amount} PHRS to ${toAddress}!`, 'success');
      this.logger.log(`Transaction: ${CONFIG.EXPLORER_URL}${tx.hash}`, 'info');
      
      return { success: true, txHash: tx.hash };
    } catch (error) {
      this.logger.log(`Transfer failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async claimFaucet() {
    try {
      this.logger.log(`Checking faucet eligibility...`, 'loading');

      const message = "pharos";
      const signature = await this.wallet.signMessage(message);
      this.logger.log(`Signed message: ${signature}`, 'info');

      const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${this.wallet.address}&signature=${signature}&invite_code=S6NGMzXSCDBxhnwo`;
      const headers = {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.8",
        authorization: "Bearer null",
        "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "sec-gpc": "1",
        Referer: "https://testnet.pharosnetwork.xyz/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "User-Agent": randomUseragent.getRandom(),
      };

      this.logger.log(`Sending login request...`, 'loading');
      const loginResponse = await axios.post(loginUrl, null, { headers });
      const loginData = loginResponse.data;

      if (loginData.code !== 0 || !loginData.data.jwt) {
        throw new Error(`Login failed: ${loginData.msg || 'Unknown error'}`);
      }

      const jwt = loginData.data.jwt;
      this.logger.log(`Login successful, JWT obtained`, 'success');

      const statusUrl = `https://api.pharosnetwork.xyz/faucet/status?address=${this.wallet.address}`;
      const statusHeaders = {
        ...headers,
        authorization: `Bearer ${jwt}`,
      };

      this.logger.log(`Checking faucet status...`, 'loading');
      const statusResponse = await axios.get(statusUrl, { headers: statusHeaders });
      const statusData = statusResponse.data;

      if (statusData.code !== 0 || !statusData.data) {
        throw new Error(`Faucet status check failed: ${statusData.msg || 'Unknown error'}`);
      }

      if (!statusData.data.is_able_to_faucet) {
        const nextAvailable = new Date(statusData.data.avaliable_timestamp * 1000).toLocaleString();
        this.logger.log(`Faucet not available until: ${nextAvailable}`, 'warn');
        return { success: false, message: `Faucet not available until ${nextAvailable}` };
      }

      const claimUrl = `https://api.pharosnetwork.xyz/faucet/daily?address=${this.wallet.address}`;
      this.logger.log(`Claiming faucet...`, 'loading');
      const claimResponse = await axios.post(claimUrl, null, { headers: statusHeaders });
      const claimData = claimResponse.data;

      if (claimData.code === 0) {
        this.logger.log(`Faucet claimed successfully!`, 'success');
        return { success: true, message: "Faucet claimed successfully" };
      } else {
        throw new Error(`Faucet claim failed: ${claimData.msg || 'Unknown error'}`);
      }
    } catch (error) {
      this.logger.log(`Faucet claim failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async performCheckIn() {
    try {
      this.logger.log(`Performing daily check-in...`, 'loading');

      const message = "pharos";
      const signature = await this.wallet.signMessage(message);
      this.logger.log(`Signed message: ${signature}`, 'info');

      const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${this.wallet.address}&signature=${signature}&invite_code=S6NGMzXSCDBxhnwo`;
      const headers = {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.8",
        authorization: "Bearer null",
        "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "sec-gpc": "1",
        Referer: "https://testnet.pharosnetwork.xyz/",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "User-Agent": randomUseragent.getRandom(),
      };

      this.logger.log(`Sending login request...`, 'loading');
      const loginResponse = await axios.post(loginUrl, null, { headers });
      const loginData = loginResponse.data;

      if (loginData.code !== 0 || !loginData.data.jwt) {
        throw new Error(`Login failed: ${loginData.msg || 'Unknown error'}`);
      }

      const jwt = loginData.data.jwt;
      this.logger.log(`Login successful, JWT obtained`, 'success');

      const checkInUrl = `https://api.pharosnetwork.xyz/sign/in?address=${this.wallet.address}`;
      const checkInHeaders = {
        ...headers,
        authorization: `Bearer ${jwt}`,
      };

      this.logger.log(`Sending check-in request...`, 'loading');
      const checkInResponse = await axios.post(checkInUrl, null, { headers: checkInHeaders });
      const checkInData = checkInResponse.data;

      if (checkInData.code === 0) {
        this.logger.log(`Check-in successful!`, 'success');
        return { success: true, message: "Check-in successful" };
      } else {
        this.logger.log(`Check-in failed: ${checkInData.msg || 'Already checked in today'}`, 'warn');
        return { success: false, message: checkInData.msg || 'Check-in failed' };
      }
    } catch (error) {
      this.logger.log(`Check-in failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async executeAllActions() {
    this.logger.banner('Pharos Testnet Bot - Wallet Actions');
    this.logger.log(`Starting operations for wallet`, 'wallet');
    
    await this.printBalances();
    
    // Claim faucet
    await this.claimFaucet();
    
    // Perform check-in
    await this.performCheckIn();
    
    // Perform transfers
    this.logger.log(`Initiating ${CONFIG.TRANSFER_COUNT} transfers...`, 'loading');
    for (let i = 0; i < CONFIG.TRANSFER_COUNT; i++) {
      await this.transferPHRS(CONFIG.TRANSFER_AMOUNT);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Perform swaps
    const swapPairs = [
      { from: "PHRS", to: "USDC", amount: CONFIG.SWAP_AMOUNTS.PHRS_TO_STABLE },
      { from: "PHRS", to: "USDT", amount: CONFIG.SWAP_AMOUNTS.PHRS_TO_STABLE },
      { from: "USDC", to: "PHRS", amount: CONFIG.SWAP_AMOUNTS.STABLE_TO_PHRS },
      { from: "USDT", to: "PHRS", amount: CONFIG.SWAP_AMOUNTS.STABLE_TO_PHRS }
    ];
    
    for (const pair of swapPairs) {
      await this.swapTokens(pair.from, pair.to, pair.amount);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    await this.printBalances();
    this.logger.log(`All operations completed for wallet`, 'success');
    this.logger.separator();
  }
}

// Main execution with enhanced proxy tracking
(async () => {
  const restartInterval = 60 * 60 * 1000; // 60 minutes
  const delayBetweenAccounts = 15000; // 15 seconds
  
  // Load configuration
  const loadConfig = () => {
    const privateKeys = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : 
      fs.existsSync('privateKeys.txt') ? 
      fs.readFileSync('privateKeys.txt', 'utf8').trim().split('\n') : [];
    
    if (!privateKeys.length) {
      throw new Error("No private keys found in .env or privateKeys.txt");
    }
    
    const proxies = (() => {
      try {
        return fs.readFileSync('proxies.txt', 'utf8')
          .split('\n')
          .map(line => line.trim())
          .filter(line => line);
      } catch (error) {
        console.log(colors.yellow('No proxies.txt found, using direct connections'));
        return [];
      }
    })();
    
    return { privateKeys, proxies };
  };

  const processWallet = async (privateKey, proxy, index) => {
    const wallet = new ethers.Wallet(privateKey);
    const logger = new WalletLogger(wallet.address, proxy);
    
    logger.banner(`Processing Wallet ${index}`);
    logger.log(`Using proxy: ${proxy || 'Direct connection'}`, 'info');
    
    try {
      const swapper = new EnhancedTokenSwapper(privateKey, proxy);
      await swapper.executeAllActions();
    } catch (error) {
      logger.log(`Error processing wallet: ${error.message}`, 'error');
    }
  };

  const runScript = async () => {
  console.clear();
  console.log(colors.cyan.bold(`
    ██████╗ ██╗  ██╗ █████╗ ██████╗  ██████╗ ███████╗
    ██╔══██╗██║  ██║██╔══██╗██╔══██╗██╔═══██╗██╔════╝
    ██████╔╝███████║███████║██████╔╝██║   ██║███████╗
    ██╔═══╝ ██╔══██║██╔══██║██╔══██╗██║   ██║╚════██║
    ██║     ██║  ██║██║  ██║██║  ██║╚██████╔╝███████║
    ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
    Pharos Testnet Bot - Multi-Account Manager
  `));
  
  const { privateKeys, proxies } = loadConfig();
  
  // Show proxy assignment table
  const wallets = privateKeys.map((key, i) => ({
    address: new ethers.Wallet(key.trim()).address,
    proxy: proxies[i] ? proxies[i].trim() : null
  }));
  
  const logger = new WalletLogger(); // Now works with default "SYSTEM" address
  logger.showProxyAssignment(wallets);
  
  // Process accounts
  for (let i = 0; i < privateKeys.length; i++) {
    const privateKey = privateKeys[i].trim();
    const proxy = proxies[i] ? proxies[i].trim() : null;
    
    await processWallet(privateKey, proxy, i + 1);
    
    if (i < privateKeys.length - 1) {
      console.log(colors.gray(`\nWaiting ${delayBetweenAccounts/1000} seconds before next wallet...\n`));
      await new Promise(resolve => setTimeout(resolve, delayBetweenAccounts));
    }
  }
  
  console.log(colors.yellow(`\nNext execution in ${restartInterval/60000} minutes...`));
};
  
  // Run immediately and then set up the interval
  await runScript();
  const intervalId = setInterval(runScript, restartInterval);
  
  // Handle process termination
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.log(colors.yellow('\n🛑 Bot stopped gracefully'));
    process.exit();
  });
})();