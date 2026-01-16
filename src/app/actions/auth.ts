'use server';

import { docClient, TABLE_NAME } from "@/lib/dynamodb";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import crypto from 'crypto';

function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

export async function registerUser(email: string, password: string) {
    if (!email || !password) return { success: false, error: 'Missing credentials' };

    const emailLower = email.toLowerCase();
    const pk = `USER#${emailLower}`;

    try {
        // Check if exists
        const check = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk, SK: 'PROFILE' }
        }));

        if (check.Item) {
            return { success: false, error: 'User already exists' };
        }

        // Create
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: pk,
                SK: 'PROFILE',
                email: emailLower,
                password: hashPassword(password),
                createdAt: new Date().toISOString()
            }
        }));

        return { success: true, email: emailLower };
    } catch (e: any) {
        console.error("Register Error:", e);
        return { success: false, error: e.message };
    }
}

export async function loginUser(email: string, password: string) {
    if (!email || !password) return { success: false, error: 'Missing credentials' };

    const emailLower = email.toLowerCase();

    try {
        const res = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${emailLower}`,
                SK: 'PROFILE'
            }
        }));

        if (!res.Item) {
            return { success: false, error: 'User not found' };
        }

        const hashed = hashPassword(password);
        if (hashed !== res.Item.password) {
            return { success: false, error: 'Invalid password' };
        }

        return { success: true, email: emailLower };
    } catch (e: any) {
        console.error("Login Error:", e);

        return { success: false, error: e.message };
    }
}
