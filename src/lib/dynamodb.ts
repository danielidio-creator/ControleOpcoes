import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const isDev = process.env.NODE_ENV === 'development';

const dbClient = new DynamoDBClient({
    region: "sa-east-1", // Matches Python setup
    endpoint: isDev ? "http://localhost:8000" : undefined,
    credentials: isDev ? {
        accessKeyId: "dummy", // Matches Python setup
        secretAccessKey: "dummy"
    } : undefined,
});

export const docClient = DynamoDBDocumentClient.from(dbClient);

export const TABLE_NAME = "AppControleOpcoes";
