# SignalSorcerer: MT5 Automator Telegram Bot

SignalSorcerer is a Telegram bot that facilitates automatic trade execution on MetaTrader 5 (MT5) based on trade signals received via Telegram. It supports configurable risk management, trade execution, and detailed trade information reporting. The bot can be deployed on AWS Lambda and is configurable through environment variables and a configuration file.

## Features

- **Automatic Trade Execution:** Execute trades on MT5 based on Telegram signals.
- **Risk Management:** Configurable risk factor and position sizing.
- **Trade Information Reporting:** Provides detailed trade information, including potential loss and profit.
- **Configurable Settings:** Easy configuration through environment variables and a configuration file.
- **Trade Execution Toggle:** Option to enable or disable trade execution to prevent accidental trades.
- **Detailed Logging:** Error handling and logging for easier debugging and monitoring.

## Requirements

- **Node.js**
- **[AWS Account](https://aws.amazon.com/account/)**
- **[MetaApi Account](https://metaapi.cloud/)**
- **Telegram Bot Token**

## Setup and Configuration

### Environment Variables

The bot requires several environment variables, which can be set in AWS Lambda, locally, or via AWS Systems Manager (SSM) Parameter Store. The bot will first check the SSM Parameter Store for these values. If not found, default values from `config.js` will be used.

| Variable                      | Description                                                                                             | Default Value            |
|-------------------------------|---------------------------------------------------------------------------------------------------------|--------------------------|
| `META_API_KEY`                | MetaApi key for MT5 account access. Obtainable from MetaApi platform.                                   | `''`                     |
| `META_ACCOUNT_ID`             | MetaApi account ID for MT5.                                                                             | `''`                     |
| `RISK_FACTOR`                 | Risk factor for position sizing.                                                                        | `''`                     |
| `TELEGRAM_BOT_TOKEN`          | Token for the Telegram bot. Generated via BotFather.                                                    | `''`                     |
| `DYNAMODB_TABLE_NAME`         | Name of the DynamoDB table for storing data.                                                            | `''`                     |
| `AUTHORIZED_TELEGRAM_USER`    | Username of the authorized Telegram user who can interact with the bot.                                 | `''`                     |
| `PIP_VALUE`                   | Value per pip in the account's currency.                                                                | `1`                      |
| `MIN_POSITION_SIZE`           | Minimum position size for trades.                                                                       | `0.1`                    |
| `ROUND_POSITION_SIZE`         | Flag to round position sizes.                                                                           | `true`                   |
| `ROUND_POSITION_SIZE_FACTOR`  | Rounding factor for position sizes (e.g., 0.1, 1).                                                      | `0.1`                    |
| `MAX_POSITION_SIZE`           | Maximum position size allowed.                                                                          | `0.2`                    |
| `CURRENCY_NAME`               | Name of the account currency.                                                                           | `GBP`                    |
| `CURRENCY_SYMBOL`             | Symbol of the account currency.                                                                         | `£`                      |
| `ENABLE_TRADE_EXECUTION`      | Boolean flag to enable or disable actual trade execution.                                               | `false`                  |
| `TRADE_SYMBOL_SUFFIX`         | Suffix for special symbols (used in some brokers for trading instruments).                              | `_SB`                    |
| `ALLOWED_SYMBOLS`             | Array of allowed trading symbols.                                                                       | List of major forex pairs|


### Example SSM Parameter Store JSON

To store environment variables in AWS Systems Manager (SSM) Parameter Store, you can use a JSON object:

```json
{
  "META_API_KEY": "your_metaapi_key",
  "META_ACCOUNT_ID": "your_meta_account_id",
  "RISK_FACTOR": "1",
  "TELEGRAM_BOT_TOKEN": "your_telegram_bot_token",
  "DYNAMODB_TABLE_NAME": "your_dynamodb_table_name",
  "AUTHORIZED_TELEGRAM_USER": "your_telegram_username",
  "PIP_VALUE": 10,
  "MIN_POSITION_SIZE": 0.1,
  "ROUND_POSITION_SIZE": true,
  "ROUND_POSITION_SIZE_FACTOR": 0.1,
  "MAX_POSITION_SIZE": 0.2,
  "CURRENCY_NAME": "USD",
  "CURRENCY_SYMBOL": "$",
  "ENABLE_TRADE_EXECUTION": true,
  "TRADE_SYMBOL_SUFFIX": "_SB",
  "ALLOWED_SYMBOLS": ["EURUSD", "GBPUSD", "USDJPY"]
}
```

### Configuration File (`config.js`)

The `config.js` file is used to define default values and settings. If environment variables are set, they will override these defaults.

```javascript
// config.js
module.exports = {
  META_API_KEY: process.env.META_API_KEY || 'defaultMetaApiKey',
  META_ACCOUNT_ID: process.env.META_ACCOUNT_ID || 'defaultMetaAccountId',
  AUTHORIZED_TELEGRAM_USER: process.env.AUTHORIZED_TELEGRAM_USER || 'defaultUser',
  PIP_VALUE: parseFloat(process.env.PIP_VALUE) || 10,
  ROUND_POSITION_SIZE: process.env.ROUND_POSITION_SIZE === 'true',
  MIN_POSITION_SIZE: parseFloat(process.env.MIN_POSITION_SIZE) || 0.01,
  MAX_POSITION_SIZE: parseFloat(process.env.MAX_POSITION_SIZE) || 1.0,
  CURRENCY_NAME: process.env.CURRENCY_NAME || 'USD',
  CURRENCY_SYMBOL: process.env.CURRENCY_SYMBOL || '$',
  ENABLE_TRADE_EXECUTION: process.env.ENABLE_TRADE_EXECUTION === 'true'
};
```

Configuration Details

    RISK_FACTOR: The percentage of balance to risk per trade.
    PIP_VALUE: The value of one pip in terms of account currency.
    MIN_POSITION_SIZE: The minimum allowable position size.
    ROUND_POSITION_SIZE: Whether to round the position size.
    ROUND_POSITION_SIZE_FACTOR: The factor to which the position size is rounded.
    MAX_POSITION_SIZE: The maximum allowable position size.
    CURRENCY_NAME: The name of the currency used.
    CURRENCY_SYMBOL: The symbol of the currency used.
    ENABLE_TRADE_EXECUTION: Whether trade execution is enabled or not.
    TRADE_SYMBOL_SUFFIX: Suffix appended to trade symbols for special cases.
    ALLOWED_SYMBOLS: A list of allowed trading symbols.

### Obtaining MetaApi Key and Account Details

1. **Create an Account on [MetaApi](https://metaapi.cloud/):**
   - Register and create an API key for your MT5 account.
   - Follow MetaApi's [documentation](https://metaapi.cloud/docs/client/) to obtain your `Account ID` and `Password`.

### Creating a Telegram Bot with BotFather

1. **Start a chat with [BotFather](https://t.me/BotFather) on Telegram.**
2. **Use the command `/newbot`** and follow the instructions to create a new bot.
3. **Name your bot and get a unique username.**
4. **Receive the bot token**, which will be used as `TELEGRAM_BOT_TOKEN`.

### Terraform Deployment

Terraform is used to manage the infrastructure deployment for SignalSorcerer, including AWS Lambda, API Gateway, and other resources.


### GitHub Actions and CI/CD Pipeline

The repository includes a GitHub Actions workflow defined in `.github/workflows/deploy.yml`. This workflow automates the deployment process using Terraform.

- **Terraform Workflow:**
   - Initializes the Terraform configuration.
   - Applies the infrastructure changes to AWS.
   - Can be triggered on push or pull request events.

To use GitHub Actions:
1. **Ensure your AWS credentials** are set up in GitHub secrets.
2. **Push changes to the repository** to trigger the workflow.
3**GitHub Actions Workflow Example:**

```yaml
name: Deploy SignalSorcerer

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Set up Terraform
      uses: hashicorp/setup-terraform@v2
      with:
        terraform_version: 1.0.0
    - name: Terraform Init
      run: terraform init
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    - name: Terraform Apply
      run: terraform apply -auto-approve
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

#### AWS IAM Roles

The AWS user executing the Terraform scripts requires specific permissions:

- `lambda:CreateFunction`
- `lambda:UpdateFunctionCode`
- `apigateway:CreateApi`
- `apigateway:CreateDeployment`
- `apigateway:CreateIntegration`
- `apigateway:CreateRoute`
- `dynamodb:CreateTable`
- `iam:CreateRole`
- `iam:AttachRolePolicy`
- `s3:CreateBucket` (if using S3 for state)
- `s3:GetObject` and `s3:PutObject` (for accessing the Terraform state in S3)
- `dynamodb:PutItem` (for state locking in DynamoDB)

#### Terraform Backend Configuration

To use S3 and DynamoDB for state management, include the following in your `main.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "path/to/your/key"
    region         = "your-region"
    dynamodb_table = "your-lock-table"
  }
}
```

### Deployment

#### AWS Lambda Setup

1. **Create AWS Lambda Functions:**
   - Create a Lambda function for the bot logic (`mt5-utils-lambda`).
   - Create a Lambda function for the authorizer (`lambda-authorizer`).

2. **Configure API Gateway:**
   - Set up API Gateway with a POST route for the Telegram webhook.
   - Attach the authorizer Lambda to the API Gateway route.

3. **Set Up Webhook for Telegram Bot:**
   - Use the `lambda_set-webhook-for-telegram-bot` function to set the webhook URL for the Telegram bot.

4. **Configure Environment Variables:**
   - Set the required environment variables in AWS Lambda.

#### Local Development and Testing

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start Local Server with Ngrok:**
   - Use Ngrok to expose your local server to the internet for Telegram webhook testing.

3. **Set Environment Variables:**
   - Create a `.env` file with the necessary environment variables.

4. **Start the Bot:**
   ```bash
   node index-local.js
   ```

## Usage

### Telegram Commands

- `/start` - Displays a welcome message.
- `/help` - Displays help and instructions.
- `/trade` - Prompts for a trade signal.
- `/calculate` - Prompts for a trade calculation without execution.
- `/cancel` - Cancels the current operation.
- `/tradelast` - Executes the last calculated trade.
- `/calculatelast` - Calculates the last trade signal.
- `/fetchconfig` - Fetch current configuration without API Keys or tokens.
- `/fetchmt5details` - Fetch MT5 details

### Example Trade Signal Format

```plaintext
📈 BUY AUDJPY @ 100.811
✅ TP1: 101.011 ✅
✅ TP2: 101.311 ✅
✅ TP3: 101.811 ✅
❌ SL: 99.811 ❌
```

### Trade Information Table

The bot will respond with a detailed trade information table, including potential loss, potential profit, the actual entry price (if available), and configurable currency symbols and names.

## Error Handling and Logs

Errors and important events are logged using a logger. This helps in diagnosing issues and understanding the bot's behavior.

## Security Considerations

- **Authorization:** Only the authorized Telegram user can interact with the bot.
- **Trade Execution Control:** The `ENABLE_TRADE_EXECUTION` flag can prevent accidental trades.
- **Environment Variables:** Sensitive information should be securely managed using environment variables.

## Contributing

Contributions to the project are welcome. Please follow the standard GitHub workflow for submitting issues and pull requests.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
