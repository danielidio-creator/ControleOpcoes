import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const isDev = process.env.NODE_ENV === 'development';

// DEBUG LOGS
// console.log("--- DynamoDB Init ---");

const clientConfig: any = {
    region: "sa-east-1",
};

if (isDev) {
    clientConfig.endpoint = "http://localhost:8000";
    clientConfig.credentials = {
        accessKeyId: "dummy",
        secretAccessKey: "dummy"
    };
} else if (process.env.MY_AWS_KEY && process.env.MY_AWS_SECRET) {
    console.log("Using Custom MY_AWS_KEY Credentials");
    clientConfig.credentials = {
        accessKeyId: process.env.MY_AWS_KEY,
        secretAccessKey: process.env.MY_AWS_SECRET
    };
} else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    console.log("Using Standard AWS_ACCESS_KEY_ID Credentials");
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
    };
} else {
    console.log("Using Default Provider Chain");
}

const dbClient = new DynamoDBClient(clientConfig);

export const docClient = DynamoDBDocumentClient.from(dbClient);

export const TABLE_NAME = "AppControleOpcoes";
