const axios = require('axios');
const fs = require('fs');
const prompt = require('prompt-sync')({ sigint: true });
const { HttpsProxyAgent } = require('https-proxy-agent');

const ACCOUNTS_FILE = 'accounts.json';
const PROXY_FILE = 'proxies.txt';
const CODE_FILE = 'code.txt';
const TOKEN_FILE = 'token.txt';

const EMAIL_DOMAINS = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'protonmail.com',
    'hotmail.com',
    'aol.com',
    'icloud.com',
    'mail.com'
];

const FIRST_NAMES = [
    'John', 'Emma', 'Michael', 'Sophia', 'James', 'Olivia', 'William', 'Ava',
    'David', 'Isabella', 'Joseph', 'Mia', 'Daniel', 'Charlotte', 'Henry', 'Amelia'
];
const LAST_NAMES = [
    'Smith', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Davis', 'Clark', 'Harris',
    'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott'
];

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
        console.log(`------------------------------------------------------------`);
        console.log(`  DDai Network Auto Sign-Up & Request Bot - Airdrop Insiders`);
        console.log(`------------------------------------------------------------${colors.reset}\n`);
    },
};

function loadProxies() {
    try {
        if (!fs.existsSync(PROXY_FILE)) {
            logger.warn('proxies.txt not found! Running without proxy.');
            return [];
        }
        const proxies = fs.readFileSync(PROXY_FILE, 'utf8').split('\n').map(line => line.trim()).filter(line => line);
        logger.info(`Loaded ${proxies.length} proxies from proxies.txt`);
        return proxies;
    } catch (error) {
        logger.error(`Error loading proxies: ${error.message}`);
        return [];
    }
}

function formatProxy(proxy) {
    let formattedProxy = proxy;
    if (!proxy.startsWith('http://') && !proxy.startsWith('https://')) {
        formattedProxy = `http://${proxy}`;
    }
    return formattedProxy;
}

function createAxiosInstance(proxy = null) {
    const config = {};
    if (proxy) {
        const formattedProxy = formatProxy(proxy);
        logger.step(`Using proxy: ${proxy}`);
        config.httpAgent = new HttpsProxyAgent(formattedProxy);
        config.httpsAgent = new HttpsProxyAgent(formattedProxy);
    }
    return axios.create(config);
}

function loadReferralCodes() {
    try {
        if (!fs.existsSync(CODE_FILE)) {
            logger.error('code.txt not found! Please create it with referral codes.');
            return [];
        }
        const codes = fs.readFileSync(CODE_FILE, 'utf8').split('\n').map(line => line.trim()).filter(line => line);
        logger.info(`Loaded ${codes.length} referral codes from code.txt`);
        return codes;
    } catch (error) {
        logger.error(`Error loading referral codes: ${error.message}`);
        return [];
    }
}

function saveAccount(account) {
    try {
        let accounts = [];
        if (fs.existsSync(ACCOUNTS_FILE)) {
            accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
        }
        const index = accounts.findIndex(acc => acc.username === account.username);
        if (index !== -1) {
            accounts[index] = account; 
        } else {
            accounts.push(account);
        }
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
        logger.success(`Account saved to ${ACCOUNTS_FILE}`);
    } catch (error) {
        logger.error(`Error saving account: ${error.message}`);
    }
}

function generateCredentials(index) {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    const username = `${firstName}${lastName}${randomNum}`;
    const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
    const email = `${username.toLowerCase()}@${domain}`;
    const timestamp = Date.now();
    const password = `Pass${timestamp}@123`;
    return { email, username, password };
}

const getHeaders = (token = '') => ({
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9,id;q=0.8',
    'content-type': 'application/json',
    'priority': 'u=1, i',
    'sec-ch-ua': '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'sec-gpc': '1',
    'Referer': 'https://app.ddai.network/',
    ...(token && { 'authorization': `Bearer ${token}` })
});

function saveToken(token, username) {
    try {
        fs.writeFileSync(`${TOKEN_FILE}_${username}.txt`, token);
        logger.success(`Token saved to token_${username}.txt`);
    } catch (error) {
        logger.error(`Error saving token for ${username}: ${error.message}`);
    }
}

async function register(axiosInstance, email, username, password, refCode) {
    logger.loading(`Registering account: ${username}`);
    try {
        const payload = { email, username, password, refCode };
        const response = await axiosInstance.post('https://auth.ddai.network/register', payload, { headers: getHeaders() });
        if (response.data.status === 'success') {
            logger.success(`Registration successful | Username: ${username} | RefCode: ${refCode}`);
            saveToken(response.data.data.accessToken, username);
            return response.data.data;
        } else {
            throw new Error('Registration failed: ' + JSON.stringify(response.data.error));
        }
    } catch (error) {
        logger.error(`Error during registration for ${username}: ${error.message}`);
        return null;
    }
}

async function login(axiosInstance, username, password) {
    logger.loading(`Logging in for ${username}...`);
    try {
        const payload = { username, password };
        const response = await axiosInstance.post('https://auth.ddai.network/login', payload, { headers: getHeaders() });
        if (response.data.status === 'success') {
            logger.success(`Login successful | Username: ${username}`);
            saveToken(response.data.data.accessToken, username);
            return response.data.data.accessToken;
        } else {
            throw new Error('Login failed: ' + JSON.stringify(response.data.error));
        }
    } catch (error) {
        logger.error(`Error during login for ${username}: ${error.message}`);
        return null;
    }
}

async function getMissions(axiosInstance, token) {
    logger.loading('Fetching missions...');
    try {
        const response = await axiosInstance.get('https://auth.ddai.network/missions', { headers: getHeaders(token) });
        if (response.data.status === 'success') {
            logger.success(`Found ${response.data.data.missions.length} missions`);
            return response.data.data.missions;
        } else {
            throw new Error('Failed to fetch missions: ' + JSON.stringify(response.data.error));
        }
    } catch (error) {
        if (error.response && error.response.status === 401) {
            logger.warn('Token expired while fetching missions');
            return 'token_expired';
        }
        logger.error(`Error fetching missions: ${error.message}`);
        return null;
    }
}

async function claimMission(axiosInstance, token, missionId, username, missionTitle) {
    logger.step(`Attempting to claim mission: ${missionTitle} (ID: ${missionId}) for ${username}`);
    try {
        const response = await axiosInstance.post(`https://auth.ddai.network/missions/claim/${missionId}`, null, { headers: getHeaders(token) });
        if (response.data.status === 'success') {
            logger.success(`Mission claimed | Reward: ${response.data.data.rewards.requests} requests`);
            return response.data;
        } else {
            throw new Error('Failed to claim mission: ' + JSON.stringify(response.data.error));
        }
    } catch (error) {
        if (error.response && error.response.status === 400) {
            logger.warn(`Mission "${missionTitle}" cannot be claimed (Error 400: Likely requires manual action or verification)`);
        } else if (error.response && error.response.status === 401) {
            logger.warn(`Token expired while claiming mission "${missionTitle}"`);
            return 'token_expired';
        } else {
            logger.error(`Error claiming mission "${missionTitle}" for ${username}: ${error.message}`);
        }
        return null;
    }
}

async function completeMissions(axiosInstance, token, username, password) {
    let currentToken = token;
    let missions = await getMissions(axiosInstance, currentToken);
    if (missions === 'token_expired') {
        currentToken = await login(axiosInstance, username, password);
        if (!currentToken) {
            logger.error('Failed to obtain new token for missions');
            return null;
        }
        missions = await getMissions(axiosInstance, currentToken);
    }
    if (!missions) {
        logger.error('Failed to fetch missions, skipping...');
        return currentToken;
    }

    for (const mission of missions) {
        if (mission.status === 'PENDING' && mission.type !== 3) { 
            const result = await claimMission(axiosInstance, currentToken, mission._id, username, mission.title);
            if (result === 'token_expired') {
                currentToken = await login(axiosInstance, username, password);
                if (!currentToken) {
                    logger.error('Failed to obtain new token for mission claim');
                    return currentToken;
                }
                await claimMission(axiosInstance, currentToken, mission._id, username, mission.title);
            } else if (result) {
                logger.success(`Completed mission: ${mission.title} for ${username}`);
            }
            await delay(3000); 
        } else if (mission.type === 3) {
            logger.warn(`Skipped mission (requires manual action): ${mission.title}`);
        } else {
            logger.info(`Mission already completed: ${mission.title}`);
        }
    }
    logger.success(`All missions processed for ${username}`);
    return currentToken;
}

async function modelResponse(axiosInstance, token, username) {
    logger.loading(`Sending Model Response request for ${username}...`);
    try {
        const response = await axiosInstance.get('https://auth.ddai.network/modelResponse', { headers: getHeaders(token) });
        logger.success(`Model Response for ${username} | Throughput: ${response.data.data.throughput}`);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            logger.warn(`Token expired during Model Response for ${username}`);
            return 'token_expired';
        } else if (error.response && error.response.status === 400) {
            logger.warn(`Model Response failed for ${username} (Error 400: Invalid request)`);
            return null;
        }
        logger.error(`Error in Model Response for ${username}: ${error.message}`);
        return null;
    }
}

async function onchainTrigger(axiosInstance, token, username) {
    logger.loading(`Sending Onchain Trigger request for ${username}...`);
    try {
        const response = await axiosInstance.post('https://auth.ddai.network/onchainTrigger', {}, { headers: getHeaders(token) });
        logger.success(`Onchain Trigger for ${username} | Requests Total: ${response.data.data.requestsTotal}`);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 401) {
            logger.warn(`Token expired during Onchain Trigger for ${username}`);
            return 'token_expired';
        } else if (error.response && error.response.status === 400) {
            logger.warn(`Onchain Trigger failed for ${username} (Error 400: Invalid request)`);
            return null;
        }
        logger.error(`Error in Onchain Trigger for ${username}: ${error.message}`);
        return null;
    }
}

async function runDataRequests(accounts, proxies) {
    logger.step('Starting data request loop for all accounts...');
    let requestCount = 0;

    while (true) {
        for (const account of accounts) {
            const { username, password } = account;
            logger.step(`Processing requests for ${username}`);
            const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null;
            const axiosInstance = createAxiosInstance(proxy);
            let token = account.accessToken;

            try {
                let result = await modelResponse(axiosInstance, token, username);
                if (result === 'token_expired') {
                    token = await login(axiosInstance, username, password);
                    if (!token) {
                        logger.error(`Unable to obtain new token for ${username}, skipping...`);
                        continue;
                    }
                    account.accessToken = token;
                    saveAccount(account);
                    result = await modelResponse(axiosInstance, token, username);
                }
                if (!result) continue;

                result = await onchainTrigger(axiosInstance, token, username);
                if (result === 'token_expired') {
                    token = await login(axiosInstance, username, password);
                    if (!token) {
                        logger.error(`Unable to obtain new token for ${username}, skipping...`);
                        continue;
                    }
                    account.accessToken = token;
                    saveAccount(account);
                    result = await onchainTrigger(axiosInstance, token, username);
                }
                if (!result) continue;
                requestCount++;
                logger.info(`Total Requests Sent for ${username}: ${requestCount}`);

                result = await modelResponse(axiosInstance, token, username);
                if (result === 'token_expired') {
                    token = await login(axiosInstance, username, password);
                    if (!token) {
                        logger.error(`Unable to obtain new token for ${username}, skipping...`);
                        continue;
                    }
                    account.accessToken = token;
                    saveAccount(account);
                    result = await modelResponse(axiosInstance, token, username);
                }
                if (!result) continue;

                result = await modelResponse(axiosInstance, token, username);
                if (result === 'token_expired') {
                    token = await login(axiosInstance, username, password);
                    if (!token) {
                        logger.error(`Unable to obtain new token for ${username}, skipping...`);
                        continue;
                    }
                    account.accessToken = token;
                    saveAccount(account);
                    result = await modelResponse(axiosInstance, token, username);
                }
                if (!result) continue;

            } catch (error) {
                logger.error(`Error in request loop for ${username}: ${error.message}`);
            }

            await delay(5000); 
        }

        logger.loading('Waiting for 30 seconds before next loop...');
        await delay(30000); 
    }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    logger.banner();
    logger.info('Starting DDai Network Auto Sign-Up & Request Bot...');

    const accountCount = parseInt(prompt('Enter the number of accounts to create: '));
    if (isNaN(accountCount) || accountCount <= 0) {
        logger.error('Invalid number of accounts. Exiting...');
        return;
    }
    logger.info(`Creating ${accountCount} accounts...`);

    const proxies = loadProxies();
    const refCodes = loadReferralCodes();
    if (refCodes.length === 0) {
        logger.error('No referral codes found. Exiting...');
        return;
    }

    const accounts = [];

    for (let i = 1; i <= accountCount; i++) {
        logger.step(`Processing account ${i} of ${accountCount}`);
        const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null;
        const axiosInstance = createAxiosInstance(proxy);
        const refCode = refCodes[Math.floor(Math.random() * refCodes.length)];

        const { email, username, password } = generateCredentials(i);
        logger.info(`Generated credentials | Email: ${email} | Username: ${username} | Password: ${password}`);

        const regData = await register(axiosInstance, email, username, password, refCode);
        if (!regData) {
            logger.error(`Failed to register account ${i}. Skipping...`);
            continue;
        }

        const account = {
            email,
            username,
            password,
            refCode,
            accessToken: regData.accessToken,
            refreshToken: regData.refreshToken,
            userId: regData.user._id,
            joinDate: regData.user.joinDate
        };
        accounts.push(account);
        saveAccount(account);

        let token = await login(axiosInstance, username, password);
        if (!token) {
            logger.error(`Failed to login for account ${i}. Skipping missions...`);
            continue;
        }

        token = await completeMissions(axiosInstance, token, username, password);
        if (!token) {
            logger.error(`Failed to process missions for account ${i}. Continuing...`);
            continue;
        }
        account.accessToken = token;
        saveAccount(account);

        logger.success(`Account ${i} processed successfully`);
        await delay(5000); 
    }

    if (accounts.length > 0) {
        logger.info(`Starting data requests for ${accounts.length} accounts...`);
        await runDataRequests(accounts, proxies);
    } else {
        logger.error('No accounts registered successfully. Exiting...');
    }
}

main().catch(err => logger.error(`Bot crashed: ${err.message}`));