import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const isDev = process.env.NODE_ENV === 'development';

// DEBUG LOGS
console.log("--- DynamoDB Init ---");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("Has AWS_ACCESS_KEY_ID:", !!process.env.AWS_ACCESS_KEY_ID);
console.log("Has AWS_SECRET_ACCESS_KEY:", !!process.env.AWS_SECRET_ACCESS_KEY);

const clientConfig: any = {
    region: "sa-east-1",
};

if (isDev) {
    clientConfig.endpoint = "http://localhost:8000";
    clientConfig.credentials = {
        accessKeyId: "dummy",
        secretAccessKey: "dummy"
    };
} else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    // Force usage of Env Vars if present
    console.log("Using Explicit Env Var Credentials");
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
} else {
    console.log("Using Default Provider Chain");
}

const dbClient = new DynamoDBClient(clientConfig);

export const docClient = DynamoDBDocumentClient.from(dbClient);

export const TABLE_NAME = "AppControleOpcoes";
