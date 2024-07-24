exports.handler = async (event, context, callback) => {

  console.log('Received event:', JSON.stringify(event, null, 2));

  const expectedToken = process.env.TELEGRAM_BOT_TOKEN;

  // Extract token from query parameters
  const token = event.queryStringParameters.token;

  console.log('Checking authorise with token ' + token + ' comparing with ' + token);

  // Validate the token
  if (token === expectedToken) {
    console.log("Success authorisation " + event.routeArn)
    return generatePolicy('user', 'Allow', event.routeArn);
  } else {
    console.log("Failed authorisation")
    return generatePolicy('user', 'Deny', event.routeArn);
  }
};

// Helper function to generate an IAM policy
const generatePolicy = (principalId, effect, resource) => {
  const authResponse = {};
  authResponse.principalId = principalId;

  if (effect && resource) {
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    };
    authResponse.policyDocument = policyDocument;
  }

  console.log("Generated policy " + JSON.stringify(authResponse))
  return authResponse;
};
