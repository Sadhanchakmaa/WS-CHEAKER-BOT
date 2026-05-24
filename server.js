import express from 'express';
import pn from 'awesome-phonenumber';
import { makeWASocket, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// pair.html এর সেশন ফোল্ডার ইউজ করুন (যেখানে আপনার টেলিগ্রাম বটের সেশন আছে)
const SESSIONS_DIR = './telegram_auth_sessions';
await fs.ensureDir(SESSIONS_DIR);

let whatsappSock = null;
let isConnecting = false;

// সেশন লোড করার ফাংশন
async function loadSession() {
    if (isConnecting) return whatsappSock;
    isConnecting = true;
    
    try {
        // telegram_auth_sessions থেকে সেশন লোড করুন
        const sessions = await fs.readdir(SESSIONS_DIR);
        let sessionFolder = null;
        
        for (const session of sessions) {
            const credsPath = `${SESSIONS_DIR}/${session}/creds.json`;
            if (await fs.pathExists(credsPath)) {
                sessionFolder = session;
                break;
            }
        }
        
        if (!sessionFolder) {
            console.log('⚠️ No session found. Please login via pair.html first!');
            isConnecting = false;
            return null;
        }
        
        const dirs = `${SESSIONS_DIR}/${sessionFolder}`;
        const { state, saveCreds } = await useMultiFileAuthState(dirs);
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            auth: state,
            browser: Browsers.macOS('Chrome'),
            printQRInTerminal: false,
            markOnlineOnConnect: false,
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        // সক রেডি হওয়া পর্যন্ত অপেক্ষা
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);
            sock.ev.on('connection.update', ({ connection }) => {
                if (connection === 'open') {
                    clearTimeout(timeout);
                    console.log('✅ WhatsApp session loaded from pair.html!');
                    resolve();
                }
            });
        });
        
        whatsappSock = sock;
        isConnecting = false;
        return sock;
        
    } catch (error) {
        console.error('Session error:', error);
        isConnecting = false;
        return null;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// নম্বর চেক করার API
app.post('/api/check-numbers', async (req, res) => {
    const { numbers } = req.body;
    
    console.log(`📥 Received ${numbers.length} numbers to check`);
    
    // সেশন চেক করুন
    if (!whatsappSock || !whatsappSock.user) {
        const sock = await loadSession();
        if (!sock || !sock.user) {
            return res.status(503).json({ 
                error: 'No WhatsApp session found. Please login via pair.html first!',
                demo: true
            });
        }
        whatsappSock = sock;
    }
    
    const existsNumbers = [];
    const notExistsNumbers = [];
    const invalidNumbers = [];
    const CONCURRENT_LIMIT = 100;
    const BATCH_DELAY = 1500;
    
    // ভ্যালিড নম্বর ফিল্টার
    const validNumbers = [];
    for (const num of numbers) {
        const cleanNum = num.replace(/[^0-9]/g, '');
        const phone = pn('+' + cleanNum);
        if (phone.isValid()) {
            validNumbers.push(cleanNum);
        } else {
            invalidNumbers.push(num);
        }
    }
    
    console.log(`🔍 Valid numbers: ${validNumbers.length}, Invalid: ${invalidNumbers.length}`);
    
    if (validNumbers.length === 0) {
        return res.json({
            exists: 0,
            notExists: 0,
            invalid: invalidNumbers.length,
            existsNumbers: [],
            notExistsNumbers: [],
            invalidNumbers: invalidNumbers
        });
    }
    
    // ব্যাচ আকারে চেক করুন
    for (let i = 0; i < validNumbers.length; i += CONCURRENT_LIMIT) {
        const batch = validNumbers.slice(i, i + CONCURRENT_LIMIT);
        const promises = batch.map(async (num) => {
            try {
                const formattedNum = '+' + num;
                const phone = pn(formattedNum);
                const jid = phone.getNumber('e164').replace('+', '') + '@s.whatsapp.net';
                const result = await whatsappSock.onWhatsApp(jid);
                const exists = result && result[0]?.exists === true;
                return { num, exists };
            } catch (err) {
                return { num, exists: false };
            }
        });
        
        const results = await Promise.all(promises);
        for (const result of results) {
            if (result.exists) {
                existsNumbers.push(result.num);
            } else {
                notExistsNumbers.push(result.num);
            }
        }
        
        console.log(`📊 Progress: ${Math.min(i + CONCURRENT_LIMIT, validNumbers.length)}/${validNumbers.length} | Found: ${existsNumbers.length} | Not: ${notExistsNumbers.length}`);
        
        if (i + CONCURRENT_LIMIT < validNumbers.length) {
            await delay(BATCH_DELAY);
        }
    }
    
    // রেজাল্ট ফাইল সেভ করুন
    const timestamp = Date.now();
    if (existsNumbers.length > 0) {
        await fs.writeFile(`whatsapp_exists_${timestamp}.txt`, existsNumbers.join('\n'));
    }
    if (notExistsNumbers.length > 0) {
        await fs.writeFile(`no_whatsapp_${timestamp}.txt`, notExistsNumbers.join('\n'));
    }
    
    console.log(`✅ Complete! Exists: ${existsNumbers.length}, Not exists: ${notExistsNumbers.length}`);
    
    res.json({
        exists: existsNumbers.length,
        notExists: notExistsNumbers.length,
        invalid: invalidNumbers.length,
        existsNumbers: existsNumbers,
        notExistsNumbers: notExistsNumbers,
        invalidNumbers: invalidNumbers,
        timestamp: timestamp
    });
});

// সেশন স্ট্যাটাস API
app.get('/api/session-status', async (req, res) => {
    if (!whatsappSock || !whatsappSock.user) {
        await loadSession();
    }
    const isActive = whatsappSock && whatsappSock.user;
    res.json({ 
        active: isActive,
        user: isActive ? whatsappSock.user : null,
        message: isActive ? 'Session is active from pair.html' : 'No session. Please login via pair.html'
    });
});

// লগআউট API
app.post('/api/logout', async (req, res) => {
    try {
        if (whatsappSock) {
            await whatsappSock.end();
            whatsappSock = null;
        }
        console.log('🗑 Session disconnected');
        res.json({ status: 'logged_out', success: true, message: 'Session disconnected' });
    } catch (err) {
        console.error('Logout error:', err);
        res.json({ status: 'error', error: err.message });
    }
});

// রিস্টার্ট API
app.post('/api/restart', async (req, res) => {
    try {
        if (whatsappSock) {
            await whatsappSock.end();
            whatsappSock = null;
        }
        isConnecting = false;
        const newSock = await loadSession();
        whatsappSock = newSock;
        res.json({ status: 'restarted', success: true, message: 'Service restarted' });
    } catch (err) {
        res.json({ status: 'error', error: err.message });
    }
});

// ক্লিয়ার ক্যাশ API
app.post('/api/clear-cache', async (req, res) => {
    try {
        console.log('🧹 Cache check requested');
        res.json({ status: 'cleared', success: true, message: 'Cache checked' });
    } catch (err) {
        res.json({ status: 'error', error: err.message });
    }
});

// সার্ভার স্টার্ট
const PORT = 8000;
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║     🚀 WS CHEAKER SERVER STARTED                 ║
║                                                  ║
║     📡 Port: ${PORT}                                ║
║     🌐 URL: http://localhost:${PORT}/ws-cheaker.html  ║
║                                                  ║
║     📱 First login: http://localhost:${PORT}/pair.html ║
║     🔗 Then use WS CHEAKER                       ║
║                                                  ║
║     ✅ Ready!                                     ║
╚══════════════════════════════════════════════════╝
    `);
    
    // automatic session load
    setTimeout(() => {
        loadSession();
    }, 1000);
});

// গ্রেসফুল শাটডাউন
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down...');
    if (whatsappSock) {
        await whatsappSock.end();
    }
    process.exit(0);
});