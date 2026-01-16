const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({
    region: "sa-east-1", // Matches Python setup
    endpoint: "http://localhost:8000",
    credentials: {
        accessKeyId: "dummy",
        secretAccessKey: "dummy"
    }
});

const TABLE_NAME = "AppControleOpcoes";

async function init() {
    try {
        const list = await client.send(new ListTablesCommand({}));
        if (list.TableNames?.includes(TABLE_NAME)) {
            console.log(`Table ${TABLE_NAME} already exists.`);
            return;
        }

        console.log(`Creating table ${TABLE_NAME}...`);
        await client.send(new CreateTableCommand({
            TableName: TABLE_NAME,
            KeySchema: [
                { AttributeName: "PK", KeyType: "HASH" },
                { AttributeName: "SK", KeyType: "RANGE" }
            ],
            AttributeDefinitions: [
                { AttributeName: "PK", AttributeType: "S" },
                { AttributeName: "SK", AttributeType: "S" }
            ],
            BillingMode: "PAY_PER_REQUEST"
        }));
        console.log("Table created successfully!");
    } catch (e) {
        if (e.code === 'ECONNREFUSED' || e.name === 'TimeoutError') {
            console.error("Error: Could not connect to DynamoDB Local at http://localhost:8000");
            console.error("Please ensure you have started DynamoDB Local (e.g., java -jar DynamoDBLocal.jar or docker run -p 8000:8000 amazon/dynamodb-local)");
        } else {
            console.error("Error initializing DB:", e);
        }
    }
}

init();
