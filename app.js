const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

const clients = new Map();

function createClient(sessionId) {
    const sessionPath = path.join(__dirname, 'sessions', sessionId);
    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: sessionPath
        }),
        puppeteer: { headless: true, args: ['--no-sandbox'] }
    });

    client.initialize();
    clients.set(sessionId, client);

    return client;
}

app.get('/connect', async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) return res.status(400).send('sessionId required');

    const client = createClient(sessionId);

    client.on('qr', async (qr) => {
        const qrImage = await qrcode.toDataURL(qr);
        res.send(`<img src="${qrImage}" alt="Scan QR code" />`);
    });

    client.on('ready', () => {
        console.log(`Client ${sessionId} is ready`);
    });

    client.on('auth_failure', msg => {
        console.error(`Auth failure for ${sessionId}`, msg);
        res.status(500).send("Authentication failed");
    });
});

app.post('/send-message', async (req, res) => {
    const { sessionId, to, message } = req.body;

    if (!sessionId || !to || !message) {
        return res.status(400).json({ error: 'sessionId, to and message are required' });
    }

    const client = clients.get(sessionId);
    if (!client) {
        return res.status(400).json({ error: 'Client not initialized or QR not scanned' });
    }

    try {
        await client.sendMessage(to + '@c.us', message);
        res.json({ status: 'Message sent' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

app.listen(PORT, () => {
    console.log(`WhatsApp server running on port ${PORT}`);
});
