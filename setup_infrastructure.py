import boto3
import sys

# Configuration
REGION = "sa-east-1"
TABLE_NAME = "AppControleOpcoes"

def create_table():
    dynamodb = boto3.client('dynamodb', region_name=REGION)
    
    try:
        # Check if table exists
        existing_tables = dynamodb.list_tables()['TableNames']
        if TABLE_NAME in existing_tables:
            print(f"✅ Table '{TABLE_NAME}' already exists in {REGION}.")
            return

        print(f"⏳ Creating table '{TABLE_NAME}' in {REGION}...")
        
        # Create Table with PK/SK Schema
        response = dynamodb.create_table(
            TableName=TABLE_NAME,
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},  # Partition Key
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}   # Sort Key
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST', # On-Demand (Free Tier friendly if low volume)
        )
        
        print(f"✅ Table creation initiated. ARN: {response['TableDescription']['TableArn']}")
        print("NOTE: It may take a moment to become active.")
        
    except Exception as e:
        print(f"❌ Error creating table: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print(f"--- Setting up Infrastructure for ControleOpções ---")
    create_table()
    print("\nNext Steps:")
    print("1. Push your code to a Git repository (GitHub, GitLab, etc.).")
    print("2. Connect the repository to AWS Amplify content.")
    print("3. Add Environment Variables (OPLAB_API_KEY) in Amplify Console.")
    print("4. Grant DynamoDB Permissions to the Amplify Role (See Guide).")
