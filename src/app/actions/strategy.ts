'use server';

import { docClient, TABLE_NAME } from "@/lib/dynamodb";
import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { Strategy } from "@/types";
import { v4 as uuidv4 } from 'uuid';

export async function saveStrategy(strategy: Omit<Strategy, 'createdAt' | 'updatedAt'> & { id?: string, createdAt?: string, userEmail: string }) {
    if (!strategy.userEmail) return { success: false, error: "User Email required" };

    const isUpdate = !!strategy.id;
    const id = strategy.id || uuidv4();
    const timestamp = new Date().toISOString();

    // Helper to remove undefined keys (DynamoDB rejects them)
    const sanitize = (obj: any): any => {
        return JSON.parse(JSON.stringify(obj, (key, value) => {
            if (value === undefined) return undefined; // Warning: JSON.stringify removes undefined
            if (Number.isNaN(value)) return null;     // Convert NaN to null
            return value;
        }));
    };

    const item: Strategy = {
        ...strategy,
        id,
        createdAt: isUpdate && strategy.createdAt ? strategy.createdAt : timestamp,
        updatedAt: timestamp
    };

    const cleanItem = sanitize(item);

    try {
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `USER#${strategy.userEmail}`,
                SK: `STRAT#${id}`,
                ...cleanItem
            }
        }));
        return { success: true, id };
    } catch (e: any) {
        console.error("Error saving strategy:", JSON.stringify(e, null, 2));
        // Return actual error message for safer debugging in dev
        return { success: false, error: e.message || "Failed to save to DynamoDB" };
    }
}

export async function deleteStrategy(id: string, userEmail: string) {
    if (!userEmail) return { success: false, error: "User Email required" };
    try {
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${userEmail}`,
                SK: `STRAT#${id}`
            }
        }));
        return { success: true };
    } catch (e: any) {
        console.error("Error deleting strategy:", e);
        return { success: false, error: e.message };
    }
}

export async function listStrategies(userEmail: string) {
    if (!userEmail) return [];
    try {
        const res = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": `USER#${userEmail}`,
                ":sk": "STRAT#"
            }
        }));
        return res.Items as Strategy[];
    } catch (e) {
        console.error("Error listing strategies:", e);
        return [];
    }
}
