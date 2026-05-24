// Fix for node-telegram-bot-api deprecation warning
process.env.NTBA_FIX_350 = '1';
process.env.NTBA_IGNORE_DEPRECATION = '1';

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs-extra';
import pino from 'pino';
import dotenv from 'dotenv';
dotenv.config();
import pn from 'awesome-phonenumber';
import {
    makeWASocket, useMultiFileAuthState, delay,
    makeCacheableSignalKeyStore, Browsers, jidNormalizedUser,
    fetchLatestBaileysVersion, DisconnectReason
} from '@whiskeysockets/baileys';

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ================ CUSTOM EMOJI MAPPING ================
const CUSTOM_EMOJI = {
    "☝️": "5370971163310693562",
    "🔍": "6230809013081086802",
    "📱": "5406809207947142040",
    "📞": "5467539229468793355",
    "📲": "5406809207947142040",
    "📧": "6066735296664315449",
    "📩": "5440411975509096877",
    "🔁": "6068952423207018572",
    "🖼": "5895654525787705071",
    "🔙": "6069102313270680292",
    "⚡": "6066849525614518693",
    "✅": "6230828091325818369",
    "❌": "6232999605315837644",
    "⚠️": "6068825953600020820",
    "💡": "6231098605545986891",
    "📊": "6233241506463883080",
    "📁": "6068690460266733076",
    "😁": "6068906707575119126",
    "📤": "5433614747381538714",
    "📥": "5433811242135331842",
    "🗑": "6233541449799966206",
    "🔄": "6233525120334306978",
    "🔽": "6233121371933646400",
    "🆙": "5364105043907716258",
    "➕": "6232999738459823976",
    "◀️": "6069102313270680292",
    "📌": "6069019922913042683",
    "📝": "6068756607058058490",
    "📖": "5226512880362332956",
    "📂": "6068668585998295496",
    "📄": "5873153278023307367",
    "🔒": "5870704313440932932",
    "🎯": "5350460637182993292",
    "🏠": "5897974332113554932",
    "🔑": "5330115548900501467",
    "📦": "5348149223223211884",
    "🔢": "6069063503946193958",
    "1️⃣": "5305763715692377402",
    "2️⃣": "5307907239380528763",
    "3️⃣": "5305783000095537258",
    "4️⃣": "5305255243104138538",
    "5️⃣": "5305288155438526869",
    "▶️": "6233040536354168126",
    "📸": "6068757169698774770",
    "📚": "6068862933268438405",
    "⚙️": "5895577117592128901",
    "✨": "6233513150260454199",
    "🔵": "6231224366483384495",
    "🟢": "6068748090137911256",
    "🔴": "6233042091132329496",
    "⏳": "6068683476649911076",
    "🆔": "5841276284155467413",
    "📢": "6069037893056208851",
    "🚫": "6068656199312612368",
    "🌍": "6233278851204521733",
    "📍": "6069019922913042683",
    "💬": "6230972419406830926",
    "👥": "5372926953978341366",
    "👤": "6068906707575119126",
    "🤖": "6231151468003467518",
    "➤": "6066595151881445205",
    "👇": "6233121371933646400",
};

// ================ CUSTOM EMOJI CONVERT FUNCTION ================
function toCustomEmoji(text) {
    let result = text;
    for (const [emojiChar, emojiId] of Object.entries(CUSTOM_EMOJI)) {
        const regex = new RegExp(emojiChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        if (result.match(regex)) {
            result = result.replace(regex, `<tg-emoji emoji-id="${emojiId}">${emojiChar}</tg-emoji>`);
        }
    }
    return result;
}

// ================ BUTTONS WITH STYLE + CUSTOM EMOJI ================

// MAIN BUTTON - Added LOGOUT button with style + icon_custom_emoji_id
const MAIN_BUTTON = {
    reply_markup: {
        keyboard: [
            [
                { text: 'CREATE SESSION', style: 'primary', icon_custom_emoji_id: CUSTOM_EMOJI["😁"] },
                { text: 'WS CHECKER', style: 'success', icon_custom_emoji_id: CUSTOM_EMOJI["🔍"] }
            ],
            [
                { text: 'HELP', style: 'primary', icon_custom_emoji_id: CUSTOM_EMOJI["📖"] }
            ],
            [
                { text: 'LOGOUT', style: 'danger', icon_custom_emoji_id: CUSTOM_EMOJI["🚫"] }
            ]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    }
};

// CREATE SESSION BUTTON - Shows when CREATE SESSION is clicked
const CREATE_SESSION_BUTTON = {
    reply_markup: {
        keyboard: [
            [
                { text: 'PAIRING CODE', style: 'success', icon_custom_emoji_id: CUSTOM_EMOJI["🔑"] }
            ],
            [
                { text: 'BACK TO MAIN', style: 'danger', icon_custom_emoji_id: CUSTOM_EMOJI["🔙"] }
            ]
        ],
        resize_keyboard: true
    }
};

// WS CHECKER BUTTON - Shows when WS CHECKER is clicked
const WS_CHECKER_BUTTON = {
    reply_markup: {
        keyboard: [
            [
                { text: 'SEND TXT FILE', style: 'primary', icon_custom_emoji_id: CUSTOM_EMOJI["📁"] },
                { text: 'LINE BY LINE', style: 'primary', icon_custom_emoji_id: CUSTOM_EMOJI["📝"] }
            ],
            [
                { text: 'BACK TO MAIN', style: 'primary', icon_custom_emoji_id: CUSTOM_EMOJI["🔙"] }
            ]
        ],
        resize_keyboard: true
    }
};

const cancelKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: 'CANCEL', style: 'danger', icon_custom_emoji_id: CUSTOM_EMOJI["❌"] }]
        ],
        resize_keyboard: true
    }
};
const doneKeyboard = {
    reply_markup: {
        keyboard: [
            [
                
                { text: 'DONE', style: 'success', icon_custom_emoji_id: CUSTOM_EMOJI["✅"] }],
                [{ text: 'CANCEL', style: 'danger', icon_custom_emoji_id: CUSTOM_EMOJI["❌"] }
            ]
        ],
        resize_keyboard: true
    }
};

const logoutKeyboard = {
    reply_markup: {
        keyboard: [
            [
                { text: 'CONFIRM', style: 'danger', icon_custom_emoji_id: CUSTOM_EMOJI["⚠️"] },
                { text: 'CANCEL', style: 'primary', icon_custom_emoji_id: CUSTOM_EMOJI["❌"] }
            ]
        ],
        resize_keyboard: true
    }
};

const userSessions = new Map();
const userPairedStatus = new Map();

const MAX_RECONNECT_ATTEMPTS = 3;
const SESSION_TIMEOUT = 5 * 60 * 1000;
const CLEANUP_DELAY = 5000;

// Batch settings - 500 numbers at once (concurrently)
const CONCURRENT_LIMIT = 200; // 500 numbers check at the same time
const BATCH_DELAY = 2000; // 2 second delay between batches

const SESSIONS_DIR = './telegram_auth_sessions';
const CHECK_RESULTS_DIR = './check_results';

// Ensure directories exist
await fs.ensureDir(SESSIONS_DIR);
await fs.ensureDir(CHECK_RESULTS_DIR);

async function removeFile(FilePath) {
    try {
        if (!fs.existsSync(FilePath)) return false;
        await fs.remove(FilePath);
        return true;
    } catch (e) { return false; }
}

async function hasUserSession(chatId) {
    try {
        if (!fs.existsSync(SESSIONS_DIR)) return false;
        const sessions = await fs.readdir(SESSIONS_DIR);
        for (const session of sessions) {
            if (session.includes(`telegram_${chatId}`)) {
                const credsPath = `${SESSIONS_DIR}/${session}/creds.json`;
                if (await fs.pathExists(credsPath)) {
                    return true;
                }
            }
        }
        return false;
    } catch (error) {
        return false;
    }
}

async function getUserSessionFolder(chatId) {
    try {
        if (!fs.existsSync(SESSIONS_DIR)) return null;
        const sessions = await fs.readdir(SESSIONS_DIR);
        for (const session of sessions) {
            if (session.includes(`telegram_${chatId}`)) {
                const credsPath = `${SESSIONS_DIR}/${session}/creds.json`;
                if (await fs.pathExists(credsPath)) {
                    return session;
                }
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

// NEW FUNCTION: Delete/Logout user session
async function deleteUserSession(chatId) {
    try {
        const sessionFolder = await getUserSessionFolder(chatId);
        if (sessionFolder) {
            const dirs = `${SESSIONS_DIR}/${sessionFolder}`;
            await fs.remove(dirs);
            userPairedStatus.delete(chatId);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting session:', error);
        return false;
    }
}

async function checkNumberExists(phoneNumber, sock) {
    const num = phoneNumber.replace(/[^0-9]/g, '');
    const phone = pn('+' + num);
    
    if (!phone.isValid()) {
        return { number: phoneNumber, exists: false, error: 'Invalid format' };
    }
    
    const formattedNum = phone.getNumber('e164').replace('+', '');
    
    try {
        const jid = formattedNum + '@s.whatsapp.net';
        
        // ✅ সক সক্রিয় কিনা চেক করুন
        if (!sock || !sock.user) {
            console.log('Socket not ready');
            return { number: phoneNumber, exists: false, error: 'Session not ready' };
        }
        
        const result = await sock.onWhatsApp(jid);
        
        // ✅ রেজাল্ট চেক করার সঠিক উপায়
        if (result && Array.isArray(result) && result.length > 0) {
            const exists = result[0]?.exists === true;
            return { 
                number: phoneNumber, 
                exists: exists, 
                error: exists ? null : 'Account not found' 
            };
        } else {
            return { number: phoneNumber, exists: false, error: 'Account not found' };
        }
    } catch (err) {
     //   console.error(`Error checking ${formattedNum}:`, err.message || err);
        
        // ✅ এরর হলে রিট্রাই করুন
        await delay(1000);
        try {
            const jid = formattedNum + '@s.whatsapp.net';
            const retryResult = await sock.onWhatsApp(jid);
            if (retryResult && retryResult[0]?.exists) {
                return { number: phoneNumber, exists: true, error: null };
            }
        } catch (retryErr) {
         //   console.error(`Retry failed:`, retryErr.message);
        }
        
        return { number: phoneNumber, exists: false, error: err.message || 'Unknown error' };
    }
}

// FIXED - Only sends files, no numbers in message
async function bulkNumberCheck(chatId, numbersList, sock) {
    const validNumbers = [];
    const invalidNumbers = [];
    
    for (const num of numbersList) {
        const cleanNum = num.replace(/[^0-9]/g, '');
        const phone = pn('+' + cleanNum);
        if (phone.isValid()) {
            validNumbers.push(cleanNum);
        } else {
            invalidNumbers.push(num);
        }
    }
    
    if (validNumbers.length === 0) {
        await bot.sendMessage(chatId, toCustomEmoji(`❌ <b>No Valid Numbers Found!</b>\n\n━━━━━━━━━━━━━━━━━━━━\n📝 <i>Please check your input format</i>\n━━━━━━━━━━━━━━━━━━━━\n\n<i>Example: 8801xxxxxxxx</i>`), { parse_mode: 'HTML' });
        return;
    }
    
    const totalValid = validNumbers.length;
    const totalBatches = Math.ceil(totalValid / CONCURRENT_LIMIT);
    
    const progressMsg = await bot.sendMessage(chatId, toCustomEmoji(`🔍 Checking ${totalValid} numbers...\n⚡ Speed: ${CONCURRENT_LIMIT} numbers at once\n📦 Total batches: ${totalBatches}\n⏳ Progress: 0/${totalValid} (0%)`), { parse_mode: 'HTML' });
    
    const created = [];
    const notCreated = [];
    let processed = 0;
    
    // Process 500 numbers at once concurrently
    for (let i = 0; i < validNumbers.length; i += CONCURRENT_LIMIT) {
        const batch = validNumbers.slice(i, i + CONCURRENT_LIMIT);
        const batchNumber = Math.floor(i / CONCURRENT_LIMIT) + 1;
        
        await bot.editMessageText(toCustomEmoji(`🔍 Checking ${totalValid} numbers...\n⚡ Batch ${batchNumber}/${totalBatches}\n⏳ Progress: ${processed}/${totalValid} (${Math.floor((processed / totalValid) * 100)}%)`), {
            chat_id: chatId,
            message_id: progressMsg.message_id,
            parse_mode: 'HTML'
        });
        
        // Check all 500 numbers at the same time
        const promises = batch.map(async (num) => {
            const result = await checkNumberExists(num, sock);
            return { num, exists: result.exists };
        });
        
        const results = await Promise.all(promises);
        
        // Process results
        for (const result of results) {
            if (result.exists) {
                created.push(result.num);
            } else {
                notCreated.push(result.num);
            }
            processed++;
        }
        
        // Delay between batches (avoid rate limiting)
        if (i + CONCURRENT_LIMIT < validNumbers.length) {
            await delay(BATCH_DELAY);
        }
    }
    
    // Delete progress message
    await bot.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
    
    // Create timestamp for files
    const timestamp = Date.now();
    
    // Save created numbers to file
    const createdFile = `${CHECK_RESULTS_DIR}/whatsapp_exists_${timestamp}.txt`;
    await fs.writeFile(createdFile, created.join('\n'));
    
    // Save not created numbers to file
    const notCreatedFile = `${CHECK_RESULTS_DIR}/no_whatsapp_${timestamp}.txt`;
    await fs.writeFile(notCreatedFile, notCreated.join('\n'));
    
    // ✅ সামারি মেসেজ পাঠান (এটা ডিলিট হবে)
    const summaryMsg = await bot.sendMessage(chatId, toCustomEmoji(`✅ <b>CHECK COMPLETED!</b>\n\n📊 <b>Summary:</b>\n📗 <b>WhatsApp Account Exists:</b> ${created.length} numbers\n📕 <b>No WhatsApp Account:</b> ${notCreated.length} numbers\n📝 <b>Invalid format:</b> ${invalidNumbers.length} numbers\n\n📁 <b>Files attached below:</b>`), { parse_mode: 'HTML' });
    
    // ফাইল পাঠান (এগুলো ডিলিট হবে না)
    if (created.length > 0) {
        await bot.sendDocument(chatId, createdFile, { 
            caption: toCustomEmoji(`✅ Numbers with WhatsApp account (${created.length} numbers)`),
            parse_mode: 'HTML'
        }, { 
            filename: `whatsapp_exists_${timestamp}.txt`,
            contentType: 'text/plain'
        });
        await delay(500);
    }
    
    if (notCreated.length > 0) {
        await bot.sendDocument(chatId, notCreatedFile, { 
            caption: toCustomEmoji(`❌ Numbers without WhatsApp account (${notCreated.length} numbers)`),
            parse_mode: 'HTML'
        }, { 
            filename: `no_whatsapp_${timestamp}.txt`,
            contentType: 'text/plain'
        });
        await delay(500);
    }
    
    if (invalidNumbers.length > 0) {
        const invalidFile = `${CHECK_RESULTS_DIR}/invalid_numbers_${timestamp}.txt`;
        await fs.writeFile(invalidFile, invalidNumbers.join('\n'));
        await bot.sendDocument(chatId, invalidFile, { 
            caption: toCustomEmoji(`⚠️ Invalid format numbers (${invalidNumbers.length} numbers)`),
            parse_mode: 'HTML'
        }, { 
            filename: `invalid_numbers_${timestamp}.txt`,
            contentType: 'text/plain'
        });
        await delay(500);
        await fs.remove(invalidFile);
    }
    
    // ✅ শুধু সামারি মেসেজ ডিলিট করুন (ফাইল ডিলিট করবেন না)
    await bot.deleteMessage(chatId, summaryMsg.message_id).catch(() => {});
    
    // Clean up files after sending (delay to ensure upload complete)
    setTimeout(async () => {
        await fs.remove(createdFile).catch(() => {});
        await fs.remove(notCreatedFile).catch(() => {});
    }, 5000);
    
}
                
// Pairing
async function startPairing(chatId, phoneNumber) {
    const num = phoneNumber.replace(/[^0-9]/g, '');
    const phone = pn('+' + num);
    
    if (!phone.isValid()) {
        await bot.sendMessage(chatId, toCustomEmoji('❌ <b>Invalid number format!</b>'), { parse_mode: 'HTML' });
        return false;
    }
    
    const formattedNum = phone.getNumber('e164').replace('+', '');
    const sessionId = `telegram_${chatId}_${Date.now()}`;
    const dirs = `${SESSIONS_DIR}/${sessionId}`;
    
    // ✅ Connecting মেসেজ সেভ করুন
    const connectingMsg = await bot.sendMessage(chatId, toCustomEmoji(`🔄 <b>Connecting to WhatsApp Server</b>\n\n📱 <i>Initializing secure session...</i>\n⏳ <i>Please wait while we connect...</i>`), { parse_mode: 'HTML' });
    
    let pairingCodeSent = false, sessionCompleted = false, isCleaningUp = false;
    let reconnectAttempts = 0, currentSocket = null, timeoutHandle = null;
    let pairingCodeMsgId = null; // ✅ পেয়ারিং কোড মেসেজের আইডি সেভ করার জন্য
    
    async function cleanup() {
        if (isCleaningUp) return;
        isCleaningUp = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        if (currentSocket) {
            try { currentSocket.ev.removeAllListeners(); await currentSocket.end(); } catch(e) {}
            currentSocket = null;
        }
    }
    
    async function initiateSession() {
        if (sessionCompleted || isCleaningUp) return;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            await bot.deleteMessage(chatId, connectingMsg.message_id).catch(() => {});
            await bot.sendMessage(chatId, toCustomEmoji('❌ <b>Connection failed.</b>'), { parse_mode: 'HTML' });
            await cleanup();
            return false;
        }
        
        try {
            if (!fs.existsSync(dirs)) await fs.mkdir(dirs, { recursive: true });
            const { state, saveCreds } = await useMultiFileAuthState(dirs);
            const { version } = await fetchLatestBaileysVersion();
            
            if (currentSocket) {
                try { currentSocket.ev.removeAllListeners(); await currentSocket.end(); } catch(e) {}
            }
            
            currentSocket = makeWASocket({
                version,
                auth: { 
                    creds: state.creds, 
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })) 
                },
                printQRInTerminal: false, 
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS('Chrome'), 
                markOnlineOnConnect: false,
            });
            
            const sock = currentSocket;
            
            sock.ev.on('connection.update', async (update) => {
                if (isCleaningUp) return;
                const { connection, lastDisconnect } = update;
                
                if (connection === 'open') {
                    if (sessionCompleted) return;
                    sessionCompleted = true;
                    
                    // ✅ Connecting মেসেজ ডিলিট করুন
                    await bot.deleteMessage(chatId, connectingMsg.message_id).catch(() => {});
                    
                    // ✅ পেয়ারিং কোডের মেসেজ ডিলিট করুন (যদি থাকে)
                    if (pairingCodeMsgId) {
                        await bot.deleteMessage(chatId, pairingCodeMsgId).catch(() => {});
                    }
                    
                    // ✅ সাফল্যের মেসেজ পাঠান
                    await bot.sendMessage(chatId, toCustomEmoji(`✅ <b>Pairing Successful!</b>\n\n📱 <b>Number:</b> <code>+${formattedNum}</code>\n✅ <b>Status:</b> <i>Ready to use</i>\n\n━━━━━━━━━━━━━━━━━━━━\n🚀 <i>Now use "WS CHECKER" to start</i>\n━━━━━━━━━━━━━━━━━━━━`), { 
    parse_mode: 'HTML',
    ...MAIN_BUTTON 
});
                    
                    userPairedStatus.set(chatId, true);
                    await cleanup();
                }
                
                if (connection === 'close') {
                    if (sessionCompleted || isCleaningUp) { 
                        await cleanup(); 
                        return; 
                    }
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        await bot.deleteMessage(chatId, connectingMsg.message_id).catch(() => {});
                        if (pairingCodeMsgId) {
                            await bot.deleteMessage(chatId, pairingCodeMsgId).catch(() => {});
                        }
                        await bot.sendMessage(chatId, toCustomEmoji('❌ <b>Invalid pairing code</b>'), { parse_mode: 'HTML' });
                        await cleanup();
                    } else if (pairingCodeSent && !sessionCompleted) {
                        reconnectAttempts++;
                        await delay(2000); 
                        await initiateSession();
                    } else { 
                        await cleanup(); 
                    }
                }
            });
            
            if (!sock.authState.creds.registered && !pairingCodeSent && !isCleaningUp) {
                await delay(1500);
                try {
                    pairingCodeSent = true;
                    const customPairingCode = "11111111";
                    let code = await sock.requestPairingCode(formattedNum, customPairingCode);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    
                    // ✅ Connecting মেসেজ ডিলিট করুন
                    await bot.deleteMessage(chatId, connectingMsg.message_id).catch(() => {});
                    
                    // ✅ পেয়ারিং কোড মেসেজ পাঠান এবং আইডি সেভ করুন
                    const pairingCodeMsg = await bot.sendMessage(chatId, toCustomEmoji(`🔑 <b>Pairing Code Received</b>\n\n━━━━━━━━━━━━━━━━━━━━\n📱 <b>Your Pairing Code:</b>\n<code>${code}</code>\n━━━━━━━━━━━━━━━━━━━━\n\n📌 <b>How to Link WhatsApp:</b>\n\n1️⃣ Open <b>WhatsApp</b> on your phone\n2️⃣ Go to <b>Settings</b> → <b>Linked Devices</b>\n3️⃣ Tap on <b>Link a Device</b>\n4️⃣ Enter this code: <code>${code}</code>\n5️⃣ Wait for confirmation\n\n━━━━━━━━━━━━━━━━━━━━\n⚠️ <b>Important Notes:</b>\n├── 🔐 Code expires in <b>5 minutes</b>\n├── 📱 Keep WhatsApp open during pairing\n└── ✅ Don't share this code with anyone\n\n━━━━━━━━━━━━━━━━━━━━\n✨ <i>Enter the code in WhatsApp now</i>\n⏳ <i>Waiting for connection...</i>`), { parse_mode: 'HTML' });
                    
                    pairingCodeMsgId = pairingCodeMsg.message_id; // ✅ আইডি সেভ করুন
                    
                } catch (error) {
                    pairingCodeSent = false;
                    await bot.deleteMessage(chatId, connectingMsg.message_id).catch(() => {});
                    await bot.sendMessage(chatId, toCustomEmoji('❌ <b>Failed to get pairing code</b>'), { parse_mode: 'HTML' });
                    await cleanup();
                }
            }
            
            sock.ev.on('creds.update', saveCreds);
            
            timeoutHandle = setTimeout(async () => {
                if (!sessionCompleted && !isCleaningUp) {
                    await bot.deleteMessage(chatId, connectingMsg.message_id).catch(() => {});
                    if (pairingCodeMsgId) {
                        await bot.deleteMessage(chatId, pairingCodeMsgId).catch(() => {});
                    }
                    await bot.sendMessage(chatId, toCustomEmoji('⏰ <b>Timeout expired</b>'), { parse_mode: 'HTML' });
                    await cleanup();
                }
            }, SESSION_TIMEOUT);
            
        } catch (err) {
            console.error(`Error:`, err);
            await bot.deleteMessage(chatId, connectingMsg.message_id).catch(() => {});
            if (pairingCodeMsgId) {
                await bot.deleteMessage(chatId, pairingCodeMsgId).catch(() => {});
            }
            await bot.sendMessage(chatId, toCustomEmoji('❌ <b>Cannot connect</b>'), { parse_mode: 'HTML' });
            await cleanup();
        }
    }
    
    await initiateSession();
    return true;
}
// user session 
async function loadUserSession(chatId) {
    try {
        const sessionFolder = await getUserSessionFolder(chatId);
        if (!sessionFolder) return null;
        
        const dirs = `${SESSIONS_DIR}/${sessionFolder}`;
        const { state } = await useMultiFileAuthState(dirs);
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })) 
            },
            printQRInTerminal: false, 
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS('Chrome'), 
        });
        
        // ✅ সক রেডি হওয়া পর্যন্ত অপেক্ষা করুন
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Socket connection timeout'));
            }, 15000);
            
            const checkConnection = () => {
                if (sock.user) {
                    clearTimeout(timeout);
                    resolve();
                }
            };
            
            sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
                if (connection === 'open') {
                    clearTimeout(timeout);
                    resolve();
                } else if (connection === 'close') {
                    clearTimeout(timeout);
                    reject(new Error('Connection closed'));
                }
            });
            
            // চেক করা শুরু করুন
            checkConnection();
        });
        
        return sock;
    } catch (error) {
        console.error('Error loading session:', error);
        return null;
    }
}

// BOT COMMANDS
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const hasSession = await hasUserSession(chatId);
    
    if (hasSession) {
        userPairedStatus.set(chatId, true);
        await bot.sendMessage(chatId, toCustomEmoji(`✅ <b>You are paired!</b>\n\n<b>📱 Status:</b> <i>Session Active</i>\n<b>🔒 Security:</b> <i>End-to-End Encrypted</i>\n\n━━━━━━━━━━━━━━━━━━━━\n📊 <b>Available Features:</b>\n🔍 <i>WS CHECKER</i> → Check WhatsApp numbers\n🚪 <i>LOGOUT</i> → Delete your session\n━━━━━━━━━━━━━━━━━━━━\n\n💡 <i>Tip: You can check unlimited numbers</i>\n⚡ <i>500 numbers at once with high speed</i>\n\n━━━━━━━━━━━━━━━━━━━━\n✨ <i>Choose an option to continue</i>`), {
            parse_mode: 'HTML',
            ...MAIN_BUTTON
        });
    } else {
        await bot.sendMessage(chatId, toCustomEmoji(`🤖 <b>WhatsApp Pairing Bot</b>\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n📊 <b>Features:</b>\n├── 🔍 Check WhatsApp Numbers\n├── ⚡ 500 Numbers Concurrently\n├── 📁 TXT File Support\n└── 🔄 Session Management\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n\n💡 <i>Choose an option from below</i>`), {
            parse_mode: 'HTML',
            ...MAIN_BUTTON
        });
    }
});

bot.onText(/LINE BY LINE/, (msg) => {
    const chatId = msg.chat.id;
    userSessions.set(chatId, { waitingForNumbers: true, mode: 'checker', numbers: [] });
    bot.sendMessage(chatId, toCustomEmoji(`📝 <b>Line By Line Input</b>\n\n━━━━━━━━━━━━━━━━━━━━\n📱 <i>Send numbers one by one</i>\n📞 <i>Format: 8801xxxxxxxx</i>\n\n📌 <b>Instructions:</b>\n├── 📝 Type each number and send\n├── ✅ Click DONE when finished\n└── 📞 Format: 8801xxxxxxxx\n\n━━━━━━━━━━━━━━━━━━━━\n⚡ <b>Features:</b>\n├── ✅ Unlimited numbers supported\n├── ⚡ 500 numbers checked at once\n└── 📊 Auto-save results as files\n\n━━━━━━━━━━━━━━━━━━━━\n📝 <i>Start sending numbers now...</i>\n✨ <i>Click DONE when complete</i>`), {
        parse_mode: 'HTML',
        ...doneKeyboard
    });
});

// LOGOUT BUTTON HANDLER - Delete session
bot.onText(/LOGOUT/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, toCustomEmoji('⚠️ Are you sure you want to logout?\n\nThis will delete your WhatsApp session.\n\nSend "CONFIRM" to logout or "CANCEL" to cancel.'), {
        parse_mode: 'HTML',
        ...logoutKeyboard
    });
    
    userSessions.set(chatId, { waitingForLogoutConfirm: true });
});

// Confirm logout
bot.onText(/CONFIRM/, async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);
    
    if (session?.waitingForLogoutConfirm) {
        userSessions.delete(chatId);
        
        const deleted = await deleteUserSession(chatId);
        
        if (deleted) {
            await bot.sendMessage(chatId, toCustomEmoji('✅ Successfully logged out!\n\nYour WhatsApp session has been deleted.\n\nUse "CREATE SESSION" to pair again.'), {
                parse_mode: 'HTML',
                ...MAIN_BUTTON
            });
        } else {
            await bot.sendMessage(chatId, toCustomEmoji('❌ No active session found to logout.'), {
                parse_mode: 'HTML',
                ...MAIN_BUTTON
            });
        }
    } else {
        await bot.sendMessage(chatId, toCustomEmoji('❌ No logout request pending.'), MAIN_BUTTON);
    }
});

// MAIN BUTTON HANDLERS
bot.onText(/CREATE SESSION/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, toCustomEmoji(`📱 <b>Create Session</b>\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n🔑 <i>Click PAIRING CODE to start</i>\n📞 <i>Send your number with country code</i>\n✅ <i>Get code & Bind Your WhatsApp</i>\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n\n💡 <i>Example: 8801xxxxxxxx</i>`), {
    parse_mode: 'HTML',
    ...CREATE_SESSION_BUTTON
});
});

bot.onText(/PAIRING CODE/, (msg) => {
    const chatId = msg.chat.id;
    userSessions.set(chatId, { waitingForNumber: true, mode: 'pair' });
    bot.sendMessage(chatId, toCustomEmoji('📞 Send your number: 8801xxxxxxxx'), {
        parse_mode: 'HTML',
        ...cancelKeyboard
    });
});

bot.onText(/WS CHECKER/, async (msg) => {
    const chatId = msg.chat.id;
    const hasSession = await hasUserSession(chatId);
    
    if (!hasSession) {
        await bot.sendMessage(chatId, toCustomEmoji(`❌ <b>No Active Session Found!</b>\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n📱 <i>Please create a session first</i>\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n\n👉 <b>Follow these steps:</b>\n1️⃣ Click <i>CREATE SESSION</i>\n2️⃣ Click <i>PAIRING CODE</i>\n3️⃣ Send your number\n4️⃣ Link with WhatsApp\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n✨ <i>Then use WS CHECKER</i>`), {
    parse_mode: 'HTML',
    ...MAIN_BUTTON
});
        return;
    }
    
    bot.sendMessage(chatId, toCustomEmoji(`✅ <b>WS Checker</b>\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n📁 <i>Choose your input method</i>\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n\n📌 <b>Options:</b>\n├── 📄 <i>SEND TXT FILE</i>\n└── 📝 <i>LINE BY LINE</i>\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n⚡ <i>500 numbers at once | High Speed</i>\n📁 <i>Unlimited numbers supported</i>\n\n✨ <i>Select an option below</i>`), {
    parse_mode: 'HTML',
    ...WS_CHECKER_BUTTON
});
});

bot.onText(/SEND TXT FILE/, (msg) => {
    const chatId = msg.chat.id;
    userSessions.set(chatId, { waitingForFile: true, mode: 'checker' });
    bot.sendMessage(chatId, toCustomEmoji(`📁 <b>Send TXT File</b>\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n📄 <i>Upload your numbers file</i>\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n\n📌 <b>Requirements:</b>\n├── 📁 <i>.txt file format</i>\n├── 📝 <i>One number per line</i>\n└── 📞 <i>Format: 8801xxxxxxxx</i>\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n⚡ <b>Features:</b>\n├── ✅ <i>Unlimited numbers supported</i>\n├── ⚡ <i>500 numbers checked at once</i>\n└── 📊 <i>Auto-save results as files</i>\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n✨ <i>Send your .txt file now</i>`), {
    parse_mode: 'HTML',
    ...cancelKeyboard
});
});



bot.onText(/HELP/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, toCustomEmoji(`📖 <b>Help Guide</b>\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n🔑 <b>1. CREATE SESSION</b>\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n├── 📞 Send your number\n├── 🔑 Get pairing code: <code>11111111</code>\n└── 🔗 Link in WhatsApp → Linked Devices\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n🔍 <b>2. WS CHECKER</b>\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n├── 📁 Send TXT file OR\n├── 📝 Type numbers line by line\n├── ✅ Check WhatsApp account exists\n├── 📊 Unlimited numbers supported\n├── ⚡ 500 numbers at once (concurrent)\n├── 🚀 Very fast!\n└── 📁 Results sent as files\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n🚪 <b>3. LOGOUT</b>\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n├── 🗑 Delete your WhatsApp session\n└── ⚠️ Requires confirmation\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n📁 <b>4. TXT FILE FORMAT</b>\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n├── 📝 One number per line\n└── 📞 Example: <code>8801xxxxxxxx</code>\n\n<b>━━━━━━━━━━━━━━━━━━━━</b>\n💡 <i>Tip: Use country code before number</i>\n⚡ <i>500 numbers checked simultaneously!</i>\n\n✨ <i>Click CANCEL to go back</i>`), {
        parse_mode: 'HTML',
        ...cancelKeyboard
    });
});

bot.onText(/BACK TO MAIN/, (msg) => {
    const chatId = msg.chat.id;
    userSessions.delete(chatId);
    bot.sendMessage(chatId, toCustomEmoji('◀️ Back to main menu:'), {
        parse_mode: 'HTML',
        ...MAIN_BUTTON
    });
});

bot.onText(/CANCEL/, (msg) => {
    const chatId = msg.chat.id;
    userSessions.delete(chatId);
    bot.sendMessage(chatId, toCustomEmoji(`❌ <b>Cancelled!</b>\n\n━━━━━━━━━━━━━━━━━━━━\n📱 <i>Operation has been cancelled</i>\n✨ <i>You are back to main menu</i>\n━━━━━━━━━━━━━━━━━━━━`), {
        parse_mode: 'HTML',
        ...MAIN_BUTTON
    });
});

// HANDLE MESSAGES
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (text?.startsWith('/')) return;
    if (text === 'CREATE SESSION' || text === 'WS CHECKER' || text === 'HELP' || 
        text === 'PAIRING CODE' || text === 'SEND TXT FILE' || text === 'LINE BY LINE' || 
        text === 'BACK TO MAIN' || text === 'CANCEL' || text === 'LOGOUT' || text === 'CONFIRM') return;
    
    const session = userSessions.get(chatId);
    
    if (session?.waitingForNumber && session.mode === 'pair') {
        userSessions.delete(chatId);
        await startPairing(chatId, text);
    }
    else if (session?.waitingForNumbers && session.mode === 'checker') {
        // DONE বাটন চেক করা
        if (text === 'DONE') {
            if (session.numbers.length === 0) {
                await bot.sendMessage(chatId, toCustomEmoji(`❌ <b>No numbers found!</b>`), { parse_mode: 'HTML' });
                return;
            }
            
            const sock = await loadUserSession(chatId);
            if (!sock) {
                await bot.sendMessage(chatId, toCustomEmoji(`❌ <b>Session not found!</b>\n\n📱 <i>Create session first.</i>`), { parse_mode: 'HTML' });
                userSessions.delete(chatId);
                await bot.sendMessage(chatId, toCustomEmoji(`◀️ <b>Back to main</b>`), {
                    parse_mode: 'HTML',
                    ...MAIN_BUTTON
                });
                return;
            }
            
            await bulkNumberCheck(chatId, session.numbers, sock);
            await sock.end();
            userSessions.delete(chatId);
            await bot.sendMessage(chatId, toCustomEmoji(`✅ <b>Done!</b>\n\n◀️ <i>Back to main menu</i>`), {
                parse_mode: 'HTML',
                ...MAIN_BUTTON
            });
        }
        else {
            // নম্বর যোগ করা
            session.numbers.push(text);
            userSessions.set(chatId, session);
            await bot.sendMessage(chatId, toCustomEmoji(`✅ <b>Added:</b> ${text}\n\n📊 <b>Total:</b> ${session.numbers.length}\n\n📝 <i>Send more or click DONE</i>`), {
                parse_mode: 'HTML',
                ...doneKeyboard
            });
        }
    }
});

// HANDLE TXT FILE
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);
    
    if (!session || !session.waitingForFile) return;
    
    const fileId = msg.document.file_id;
    const fileName = msg.document.file_name;
    
    if (!fileName.endsWith('.txt')) {
        await bot.sendMessage(chatId, toCustomEmoji('❌ Please send a TXT file!'), { parse_mode: 'HTML' });
        return;
    }
    
    const statusMsg = await bot.sendMessage(chatId, toCustomEmoji('📥 Downloading file...'), { parse_mode: 'HTML' });
    
    try {
        const fileLink = await bot.getFileLink(fileId);
        const response = await fetch(fileLink);
        const content = await response.text();
        let numbers = content.split('\n').filter(n => n.trim().length > 0);
        
        if (numbers.length === 0) {
            await bot.sendMessage(chatId, toCustomEmoji('❌ No numbers found in file!'), { parse_mode: 'HTML' });
            return;
        }
        
        await bot.editMessageText(toCustomEmoji(`✅ File loaded: ${numbers.length} numbers found.\n⚡ Will check ${CONCURRENT_LIMIT} numbers at once`), {
            chat_id: chatId,
            message_id: statusMsg.message_id,
            parse_mode: 'HTML'
        });
        
        const sock = await loadUserSession(chatId);
        if (!sock) {
            await bot.sendMessage(chatId, toCustomEmoji('❌ Session not found! Create session first.'), { parse_mode: 'HTML' });
            userSessions.delete(chatId);
            await bot.sendMessage(chatId, toCustomEmoji('Back to main:'), {
                parse_mode: 'HTML',
                ...MAIN_BUTTON
            });
            return;
        }
        
        await bulkNumberCheck(chatId, numbers, sock);
        await sock.end();
        userSessions.delete(chatId);
        await bot.sendMessage(chatId, toCustomEmoji(`✅ <b>Process Completed!</b>\n\n━━━━━━━━━━━━━━━━━━━━\n📊 <i>All numbers have been checked</i>\n📁 <i>Results saved as files</i>\n━━━━━━━━━━━━━━━━━━━━\n\n✨ <i>Returning to main menu...</i>`), {
    parse_mode: 'HTML',
    ...MAIN_BUTTON
});
    } catch (error) {
        console.error('File error:', error);
        await bot.sendMessage(chatId, toCustomEmoji('❌ Error reading file! Please try again.'), { parse_mode: 'HTML' });
    }
});

console.log('🤖 Telegram bot started!');