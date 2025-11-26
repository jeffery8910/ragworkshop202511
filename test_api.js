const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const USER_ID = 'web-user-demo';

async function testChat() {
    console.log('Testing POST /api/chat...');
    try {
        const res = await fetch(`${BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Hello', userId: USER_ID })
        });
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Chat Test Failed:', e);
    }
}

async function testUpdateTitle() {
    console.log('\nTesting PATCH /api/chat/session...');
    try {
        const res = await fetch(`${BASE_URL}/api/chat/session`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: USER_ID, title: 'New Title Test' })
        });
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Response:', data);
    } catch (e) {
        console.error('Update Title Test Failed:', e);
    }
}

async function testDeleteHistory() {
    console.log('\nTesting DELETE /api/chat/session...');
    try {
        const res = await fetch(`${BASE_URL}/api/chat/session?userId=${USER_ID}`, {
            method: 'DELETE'
        });
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Response:', data);
    } catch (e) {
        console.error('Delete History Test Failed:', e);
    }
}

async function run() {
    await testChat();
    await testUpdateTitle();
    await testDeleteHistory();
}

run();
