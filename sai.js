const nacl = require('tweetnacl');
const Base58 = require('base-58');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
};

const logger = {
  info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
  wallet: (msg) => console.log(`${colors.yellow}[➤] ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
  loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
  banner: () => {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log(`---------------------------------------------`);
    console.log(`  SAI Ref - Airdrop Insiders `);
    console.log(`---------------------------------------------${colors.reset}\n`);
  },
};

const LOGIN_MESSAGE = 'Sign this message to verify your wallet';
const NODE_ACTIVATION_MESSAGE = 'Sign to activate S.AI Node connection';

const SIGN_ENDPOINT = 'https://sailabs.xyz/api/auth/sign';
const VALIDATE_REFERRAL_ENDPOINT = 'https://sailabs.xyz/api/referrals/validate';

const HEADERS = {
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.8',
  'content-type': 'application/json',
  'sec-ch-ua': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'sec-gpc': '1',
  'Referer': 'https://sailabs.xyz/dashboard',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

let referralCode = '';
try {
  referralCode = fs.readFileSync('code.txt', 'utf8').trim();
  logger.info(`Loaded referral code: ${referralCode}`);
} catch (error) {
  logger.error(`Failed to load code.txt: ${error.message}`);
  process.exit(1);
}

let proxies = [];
try {
  const proxyData = fs.readFileSync('proxies.txt', 'utf8');
  proxies = proxyData.split('\n').map(line => line.trim()).filter(line => line);
  if (proxies.length === 0) {
    logger.warn('No proxies found in proxies.txt. Running without proxy.');
  } else {
    logger.info(`Loaded ${proxies.length} proxies from proxies.txt`);
  }
} catch (error) {
  logger.error(`Failed to load proxies.txt: ${error.message}`);
}

function getRandomProxyAgent() {
  if (proxies.length === 0) return null;
  const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
  try {
    return new HttpsProxyAgent(randomProxy);
  } catch (error) {
    logger.error(`Invalid proxy format: ${randomProxy}`);
    return null;
  }
}

function signMessage(secretKey, message) {
  const messageBuffer = Buffer.from(message);
  const signature = nacl.sign.detached(messageBuffer, secretKey);
  return Base58.encode(signature);
}

async function validateReferralCode(code) {
  logger.step('Validating referral code...');
  const body = { referralCode: code };

  const response = await axios.post(VALIDATE_REFERRAL_ENDPOINT, body, {
    headers: HEADERS,
    httpsAgent: getRandomProxyAgent()
  });

  if (response.data.success) {
    logger.success('Referral code is valid');
    return true;
  } else {
    logger.error(`Invalid referral code: ${response.data.message}`);
    return false;
  }
}

async function login(publicKey, secretKey, referralCode) {
  logger.step('Initiating login...');
  const signature = signMessage(secretKey, LOGIN_MESSAGE);
  const body = {
    publicKey,
    signature,
    referralCode
  };

  const response = await axios.post(SIGN_ENDPOINT, body, {
    headers: HEADERS,
    httpsAgent: getRandomProxyAgent()
  });
  logger.success('Login successful');
  return response.data.token;
}

async function activateNode(publicKey, secretKey) {
  logger.step('Activating node...');
  const signature = signMessage(secretKey, NODE_ACTIVATION_MESSAGE);
  const body = {
    publicKey,
    signature,
    nodeConnection: true
  };

  const headers = { ...HEADERS, Referer: 'https://sailabs.xyz/dashboard?discord_linked=true&tab=profile' };

  const response = await axios.post(SIGN_ENDPOINT, body, {
    headers,
    httpsAgent: getRandomProxyAgent()
  });
  logger.success('Node activated');
  return response.data;
}

function saveWalletDetails(wallets) {
  try {
    fs.writeFileSync('wallets.json', JSON.stringify(wallets, null, 2));
    logger.info('Wallet details saved to wallets.json');
  } catch (error) {
    logger.error(`Failed to save wallets.json: ${error.message}`);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  logger.banner();

  const isValidCode = await validateReferralCode(referralCode);
  if (!isValidCode) {
    logger.error('Exiting due to invalid referral code');
    process.exit(1);
  }

  rl.question('Enter the number of wallets to create: ', async (answer) => {
    const numWallets = parseInt(answer);
    if (isNaN(numWallets) || numWallets <= 0) {
      logger.error('Invalid number of wallets. Please enter a positive number.');
      rl.close();
      return;
    }

    logger.info(`Creating ${numWallets} wallets...`);

    const wallets = [];

    for (let i = 1; i <= numWallets; i++) {
      try {
        logger.step(`Creating wallet ${i}...`);
        const keypair = nacl.sign.keyPair();
        const secretKey = keypair.secretKey;
        const publicKey = Base58.encode(keypair.publicKey);
        const privateKey = Base58.encode(secretKey);

        logger.wallet(`New wallet created: ${publicKey}`);

        logger.loading('Logging in...');
        const loginToken = await login(publicKey, secretKey, referralCode);

        await activateNode(publicKey, secretKey);

        wallets.push({
          walletNumber: i,
          publicKey,
          privateKey,
          referralCode
        });

        logger.success(`Wallet ${i} processed successfully`);
      } catch (error) {
        logger.error(`Error processing wallet ${i}: ${error.message}`);
      }
    }

    if (wallets.length > 0) {
      saveWalletDetails(wallets);
    } else {
      logger.warn('No wallets were created successfully.');
    }

    rl.close();
  });
}

main().catch(error => logger.error(`Main error: ${error.message}`));