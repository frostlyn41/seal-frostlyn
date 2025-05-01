const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function displayBanner() {
  const bannerText = "Qualoo Auto Bot - Airdrop Insiders";
  const bannerLine = "-".repeat(bannerText.length + 8);
  
  console.log(colors.cyan);
  console.log(bannerLine);
  console.log(`    ${bannerText}    `);
  console.log(bannerLine);
  console.log(colors.reset);
}

const EMAIL = process.env.EMAIL || 'YOUR QUALOO EMAIL';
const PASSWORD = process.env.PASSWORD || 'YOUR QUALOO PASSWORD';

const DEVICE_MODELS = {
  "Xiaomi": ["Redmi Note 8 Pro", "Redmi Note 10", "Mi 11", "Poco F3", "Mi 10T Pro"],
  "Samsung": ["Galaxy S21", "Galaxy A52", "Galaxy Note 20", "Galaxy S22 Ultra", "Galaxy A72"],
  "Oppo": ["Find X3 Pro", "Reno 6", "A54", "F19 Pro", "Reno 5"],
  "Vivo": ["X60 Pro", "V21", "Y72", "X70 Pro", "V20"],
  "OnePlus": ["9 Pro", "Nord 2", "8T", "7 Pro", "Nord CE"],
  "Realme": ["GT", "8 Pro", "7", "X7 Pro", "C25"]
};

const OS_VERSIONS = ["10", "11", "12", "13", "14"];
const APP_VERSIONS = ["1.18.0+93", "1.18.1+94", "1.17.2+90", "1.18.2+95"];
const BUILD_IDS = ["QKQ1", "RKQ1", "SKQ1", "TKQ1", "VKQ1"]; 

function generateRandomDeviceId() {
  return crypto.randomBytes(16).toString('hex');
}

function generateRandomDid() {
  const randomHex = crypto.randomBytes(20).toString('hex');
  return `did:io:0x${randomHex}`;
}

function generateRandomUserAgent(deviceInfo) {
  const buildId = BUILD_IDS[Math.floor(Math.random() * BUILD_IDS.length)];
  return `Dalvik/2.1.0 (Linux; U; Android ${deviceInfo.osVersion}; ${deviceInfo.manufacturer} ${deviceInfo.model} Build/${buildId}.${Math.floor(Math.random() * 1000000)})`;
}

function generateRandomDeviceInfo() {
  const manufacturers = Object.keys(DEVICE_MODELS);
  const manufacturer = manufacturers[Math.floor(Math.random() * manufacturers.length)];
  const models = DEVICE_MODELS[manufacturer];
  const model = models[Math.floor(Math.random() * models.length)];

  const osVersion = OS_VERSIONS[Math.floor(Math.random() * OS_VERSIONS.length)];

  const appVersion = APP_VERSIONS[Math.floor(Math.random() * APP_VERSIONS.length)];
  
  return {
    os: "android",
    manufacturer: manufacturer,
    model: model,
    osVersion: osVersion,
    deviceId: generateRandomDeviceId(),
    did: generateRandomDid(),
    appVersion: appVersion
  };
}

function loadProxies() {
  try {
    const proxyData = fs.readFileSync('proxies.txt', 'utf8');
    const proxies = proxyData.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    console.log(`${colors.green}✅ Loaded ${proxies.length} proxies${colors.reset}`);
    return proxies;
  } catch (error) {
    console.log(`${colors.yellow}⚠️ No proxies found or error reading proxies.txt${colors.reset}`);
    return [];
  }
}

function getRandomProxy(proxyList) {
  if (!proxyList || proxyList.length === 0) return null;
  return proxyList[Math.floor(Math.random() * proxyList.length)];
}

function parseProxy(proxyString) {
  if (!proxyString) return null;
  
  let protocol, host, port, auth;

  if (proxyString.includes('@')) {
    const [authPart, hostPart] = proxyString.split('@');
    const protocolSplit = authPart.includes('://') ? authPart.split('://') : ['http', authPart];
    protocol = protocolSplit[0];
    auth = protocolSplit[1];
    
    const [hostStr, portStr] = hostPart.split(':');
    host = hostStr;
    port = portStr;
  } else if (proxyString.includes(':')) {
    if (proxyString.includes('://')) {
      const [protocolStr, hostPortStr] = proxyString.split('://');
      protocol = protocolStr;
      const [hostStr, portStr] = hostPortStr.split(':');
      host = hostStr;
      port = portStr;
    } else {
      protocol = 'http';
      const [hostStr, portStr] = proxyString.split(':');
      host = hostStr;
      port = portStr;
    }
  } else {
    protocol = 'http';
    host = proxyString;
    port = '80';
  }
  
  return { protocol, host, port, auth };
}

function createAxiosInstance(proxy) {
  const instance = axios.create();
  
  if (proxy) {
    const proxyConfig = parseProxy(proxy);
    if (proxyConfig) {
      const { protocol, host, port, auth } = proxyConfig;
      const proxyUrl = `${protocol}://${auth ? auth + '@' : ''}${host}:${port}`;
      instance.defaults.proxy = false;
      instance.defaults.httpsAgent = new HttpsProxyAgent(proxyUrl);
      console.log(`${colors.gray}🔄 Using proxy: ${host}:${port}${colors.reset}`);
    }
  }
  
  return instance;
}

function generateSignature() {
  const mockSignature = crypto.randomBytes(32).toString('hex');
  const recid = Math.floor(Math.random() * 2) + 27; 
  return {
    signature: `0x${mockSignature}`,
    recid: recid
  };
}

function generateNetworkDetails() {
  return "H4sIAGM6AGgA/+1YbW/bNhD+K4U+bUAsULYky/rmJW4boEkD211RrIVBSbTDWiIVkkriBf7vu9ObpUQdkAID9qFFCvOO5N1zz53Ik56sB77lVvhk8fzetULLITaxx7bjWWeo8kG1ZQEJw23gktAlSRz67swPqTuZwpL4lgrBUiskZ9aOGvZ";
}

function generateRandomIP() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

async function login(axiosInstance, email, password) {
  console.log(`${colors.yellow}🔑 Logging in with account: ${email}${colors.reset}`);
  const deviceInfo = generateRandomDeviceInfo(); 
  const userAgent = generateRandomUserAgent(deviceInfo); 
  console.log(`${colors.gray}🔄 Using User-Agent: ${userAgent}${colors.reset}`);
  try {
    const response = await axiosInstance({
      method: 'post',
      url: 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword?key=AIzaSyD1hbpX_9hDKmmdZbfze89yxzmq0GQ5qIY',
      headers: {
        'User-Agent': userAgent,
        'Content-Type': 'application/json',
        'X-Android-Package': 'com.qualoo.io',
        'X-Android-Cert': '09B738EF8BC711183D2306B32373C44990211682',
        'X-Client-Version': 'Android/Fallback/X23001000/FirebaseCore-Android',
        'X-Firebase-GMPID': '1:168002236838:android:f1e75e6dd2507bc3f35f67'
      },
      data: {
        email: email,
        password: password,
        returnSecureToken: true,
        clientType: 'CLIENT_TYPE_ANDROID'
      }
    });

    console.log(`${colors.green}✅ Login successful!${colors.reset}`);
    return response.data.idToken; 
  } catch (error) {
    console.error(`${colors.red}❌ Login failed:${colors.reset}`, error.response?.data || error.message);
    throw error;
  }
}

async function pollForGlobalTask(axiosInstance, authToken, deviceInfo) {
  console.log(`${colors.yellow}🔍 Polling for global task...${colors.reset}`);
  
  const sigData = generateSignature();
  const signature = JSON.stringify(sigData);
  const timestamp = Math.floor(Date.now() / 1000);
  const randomIP = generateRandomIP();
  
  try {
    const response = await axiosInstance({
      method: 'put',
      url: 'https://api.stg.qualoo.io/api/task/poll?type=global',
      headers: {
        'User-Agent': 'Dart/3.5 (dart:io)',
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
        'x-qualoo-app-version': deviceInfo.appVersion,
        'authorization': authToken
      },
      data: {
        device: deviceInfo,
        network: [
          {
            ts: timestamp,
            ipv4: randomIP,
            ipv6: "",
            type: "wifi",
            details: generateNetworkDetails()
          }
        ],
        signature: signature,
        pingResults: null
      }
    });

    console.log(`${colors.green}✅ Global task received: ${response.data.id || 'Unknown ID'}${colors.reset}`);
    return response.data;
  } catch (error) {
    console.error(`${colors.red}❌ Failed to poll for task:${colors.reset}`, error.response?.data || error.message);
    throw error;
  }
}

async function sendNetworkStats(axiosInstance, authToken, deviceInfo) {
  console.log(`${colors.yellow}📊 Sending network stats...${colors.reset}`);
  
  const sigData = generateSignature();
  const signature = JSON.stringify(sigData);
  const timestamp = Math.floor(Date.now() / 1000);
  const randomIP = generateRandomIP();
  
  try {
    const response = await axiosInstance({
      method: 'post',
      url: 'https://api.stg.qualoo.io/api/network/stats?onthemove=1',
      headers: {
        'User-Agent': 'Dart/3.5 (dart:io)',
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
        'x-qualoo-app-version': deviceInfo.appVersion,
        'authorization': authToken
      },
      data: {
        device: deviceInfo,
        network: [
          {
            ts: timestamp,
            ipv4: randomIP,
            ipv6: "",
            type: "wifi",
            details: generateNetworkDetails()
          }
        ],
        signature: signature,
        pingResults: null
      }
    });

    console.log(`${colors.green}✅ Network stats sent successfully${colors.reset}`);
    return response.data;
  } catch (error) {
    console.error(`${colors.red}❌ Failed to send network stats:${colors.reset}`, error.response?.data || error.message);
    throw error;
  }
}

async function sendOnTheMoveData(axiosInstance, authToken, deviceInfo) {
  console.log(`${colors.yellow}🚶 Sending on-the-move data...${colors.reset}`);
  
  const sigData = generateSignature();
  const signature = JSON.stringify(sigData);
  const timestamp = Math.floor(Date.now() / 1000);
  const randomIP = generateRandomIP();
  
  try {
    const response = await axiosInstance({
      method: 'post',
      url: 'https://us-central1-qualoo-ea365.cloudfunctions.net/newOnTheMoveData',
      headers: {
        'User-Agent': 'okhttp/4.10.0',
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
        'authorization': `Bearer ${authToken}`,
        'firebase-instance-id-token': 'fnkqxGfEQGSsZQGTPqIjXl:APA91bEOjPdSWyICIdVniWo1lWqX6xj_iAdHC58tbvQSLjj1ScOCcPh0trLTc1IHSVZvrsz6hPPMVYK8590jSFiek6p_0K1zyLJe3w1nv64GvWdA17pMr80'
      },
      data: {
        data: {
          signature: signature,
          pingResults: [],
          device: deviceInfo,
          network: [
            {
              ipv4: randomIP,
              ipv6: "",
              details: generateNetworkDetails(),
              type: "wifi",
              ts: timestamp
            }
          ]
        }
      }
    });

    console.log(`${colors.green}✅ On-the-move data sent successfully${colors.reset}`);
    return response.data;
  } catch (error) {
    console.error(`${colors.red}❌ Failed to send on-the-move data:${colors.reset}`, error.response?.data || error.message);
    throw error;
  }
}

async function submitTaskResult(axiosInstance, authToken, taskId, deviceInfo) {
  console.log(`${colors.yellow}📝 Submitting task result for task ID: ${taskId}${colors.reset}`);
  
  const sigData = generateSignature();
  const signature = JSON.stringify(sigData);
  const timestamp = Math.floor(Date.now() / 1000);
  const randomIP = generateRandomIP();
  
  try {
    const response = await axiosInstance({
      method: 'put',
      url: `https://api.stg.qualoo.io/api/task/${taskId}/submit`,
      headers: {
        'User-Agent': 'Dart/3.5 (dart:io)',
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
        'x-qualoo-app-version': deviceInfo.appVersion,
        'authorization': authToken
      },
      data: {
        ts: timestamp,
        stats: {
          device: deviceInfo,
          network: [
            {
              ts: timestamp + 2,
              ipv4: randomIP,
              ipv6: "",
              type: "wifi",
              details: "H4sIAO46A/Xf/8/8IGvwsowAQA="
            }
          ],
          signature: signature
        }
      }
    });

    console.log(`${colors.green}✅ Task submitted successfully!${colors.reset}`);
    return response.data;
  } catch (error) {
    console.error(`${colors.red}❌ Failed to submit task:${colors.reset}`, error.response?.data || error.message);
    throw error;
  }
}

function loadAccounts() {
  try {
    const multiEmail = process.env.EMAILS;
    const multiPassword = process.env.PASSWORDS;
    
    if (multiEmail && multiPassword) {
      const emails = multiEmail.split(',').map(email => email.trim());
      const passwords = multiPassword.split(',').map(pwd => pwd.trim());
      
      if (emails.length !== passwords.length) {
        console.log(`${colors.yellow}⚠️ Warning: Number of emails (${emails.length}) doesn't match number of passwords (${passwords.length})${colors.reset}`);
        return [{email: EMAIL, password: PASSWORD}];
      }
      
      const accounts = emails.map((email, index) => ({
        email: email,
        password: passwords[index]
      }));
      
      console.log(`${colors.green}✅ Loaded ${accounts.length} accounts from .env${colors.reset}`);
      return accounts;
    } else {
      return [{email: EMAIL, password: PASSWORD}];
    }
  } catch (error) {
    console.log(`${colors.yellow}⚠️ Error loading accounts from .env: ${error.message}${colors.reset}`);
    return [{email: EMAIL, password: PASSWORD}];
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function displayDeviceInfo(deviceInfo) {
  console.log(`${colors.white}📱 Device: ${deviceInfo.manufacturer} ${deviceInfo.model} (Android ${deviceInfo.osVersion})${colors.reset}`);
}

function createEnvFileIfNeeded() {
  if (!fs.existsSync('.env')) {
    const envContent = `# Qualoo Bot Configuration
# Single account setup
EMAIL=
PASSWORD=

# Multiple accounts setup (comma separated)
# EMAILS=email1@example.com,email2@example.com,email3@example.com
# PASSWORDS=password1,password2,password3
`;
    fs.writeFileSync('.env', envContent);
    console.log(`${colors.green}✅ Created .env file with sample configuration${colors.reset}`);
  }
}

async function main() {
  displayBanner();
  
  createEnvFileIfNeeded();
  
  const accounts = loadAccounts();
  const proxies = loadProxies();
  
  const submissionsPerAccount = parseInt(await askQuestion(`${colors.white}Enter the number of task submissions per account: ${colors.reset}`));
  
  if (isNaN(submissionsPerAccount) || submissionsPerAccount <= 0) {
    console.log(`${colors.red}❌ Invalid number. Please enter a positive number.${colors.reset}`);
    return;
  }
  
  console.log(`${colors.green}🚀 Starting Qualoo Auto Bot with ${submissionsPerAccount} submissions per account (${accounts.length} accounts)${colors.reset}`);
  
  let totalSuccessCount = 0;
  let totalFailCount = 0;
  
  for (let accountIndex = 0; accountIndex < accounts.length; accountIndex++) {
    const account = accounts[accountIndex];
    
    console.log(`\n${colors.white}======= ACCOUNT ${accountIndex + 1}/${accounts.length} =======`);
    console.log(`📧 Email: ${account.email}`);
    console.log(`===============================${colors.reset}`);
    
    let accountSuccessCount = 0;
    let accountFailCount = 0;
    
    try {
      const proxy = getRandomProxy(proxies);
      const axiosInstance = createAxiosInstance(proxy);
      
      const authToken = await login(axiosInstance, account.email, account.password);
      
      for (let i = 1; i <= submissionsPerAccount; i++) {
        console.log(`\n${colors.white}--- Submission ${i}/${submissionsPerAccount} ---${colors.reset}`);
        
        try {
          const deviceInfo = generateRandomDeviceInfo();
          displayDeviceInfo(deviceInfo);

          const taskResponse = await pollForGlobalTask(axiosInstance, authToken, deviceInfo);
          const taskId = taskResponse.id || 'cm9kjwp4oiqydxpshcby1islh'; 

          await sendNetworkStats(axiosInstance, authToken, deviceInfo);

          await sendOnTheMoveData(axiosInstance, authToken, deviceInfo);

          await submitTaskResult(axiosInstance, authToken, taskId, deviceInfo);
          
          console.log(`${colors.green}✅ Submission ${i} completed successfully!${colors.reset}`);
          accountSuccessCount++;
          totalSuccessCount++;

          if (i < submissionsPerAccount) {
            const delay = 5000 + Math.floor(Math.random() * 5000); 
            console.log(`${colors.gray}⏳ Waiting ${delay/1000} seconds before next submission...${colors.reset}`);
            await sleep(delay);
          }
        } catch (error) {
          console.error(`${colors.red}❌ Submission ${i} failed:${colors.reset}`, error.message);
          accountFailCount++;
          totalFailCount++;
        }
      }
    } catch (error) {
      console.error(`${colors.red}❌ Account login failed:${colors.reset}`, error.message);
      accountFailCount += submissionsPerAccount; 
      totalFailCount += submissionsPerAccount;
      console.log(`${colors.red}❌ Skipping all submissions for this account due to login failure${colors.reset}`);
    }

    console.log(`\n${colors.white}--- Account ${accountIndex + 1} Summary ---`);
    console.log(`📧 Email: ${account.email}`);
    console.log(`${colors.green}✅ Successful: ${accountSuccessCount}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${accountFailCount}${colors.reset}`);
    console.log(`${colors.white}----------------------------${colors.reset}`);

    if (accountIndex < accounts.length - 1) {
      const accountDelay = 10000 + Math.floor(Math.random() * 5000); 
      console.log(`${colors.gray}⏳ Switching to next account in ${accountDelay/1000} seconds...${colors.reset}`);
      await sleep(accountDelay);
    }
  }

  console.log(`\n${colors.white}========== FINAL SUMMARY ==========`);
  console.log(`👤 Total accounts: ${accounts.length}`);
  console.log(`🎯 Total submissions attempted: ${accounts.length * submissionsPerAccount}`);
  console.log(`${colors.green}✅ Total successful: ${totalSuccessCount}${colors.reset}`);
  console.log(`${colors.red}❌ Total failed: ${totalFailCount}${colors.reset}`);
  console.log(`${colors.white}===================================${colors.reset}`);
}

main();