import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  Leg: a.customType({
    optionTicker: a.string().required(),
    type: a.enum(['CALL', 'PUT']),
    operation: a.enum(['COMPRA', 'VENDA']),
    strike: a.float().required(),
    dte: a.integer(),
    quantity: a.integer().required(),
    entryPremium: a.float().required(),
    exitPremium: a.float(),
    currentQuote: a.float(),
  }),

  StrategyType: a.enum(['RENDA', 'DIRECAO', 'ROLAGEM', 'VOLATILIDADE', 'LATERAL']),
  StrategyStatus: a.enum(['OPEN', 'CLOSED']),

  Strategy: a.model({
    ticker: a.string().required(),
    type: a.ref('StrategyType'),
    status: a.ref('StrategyStatus'),
    legs: a.ref('Leg').array().required(),
    totalEntryPremium: a.float(),
    percentToStrike: a.float(), // Calculated snapshot
  })
    .authorization(allow => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
