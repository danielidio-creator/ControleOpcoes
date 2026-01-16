import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
});

// Grant permission to access the external DynamoDB table
const externalTableArn = 'arn:aws:dynamodb:sa-east-1:*:table/AppControleOpcoes';

backend.compute.resources.lambda.addToRolePolicy(
  {
    Action: [
      'dynamodb:PutItem',
      'dynamodb:GetItem',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem',
      'dynamodb:Query',
      'dynamodb:Scan'
    ],
    Resource: [externalTableArn, `${externalTableArn}/index/*`],
    Effect: 'Allow',
  } as any
);
