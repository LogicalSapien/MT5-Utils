provider "aws" {
  region = var.aws_region
}

data "aws_ssm_parameter" "mt5_utils_credentials" {
  name = "/mt5-utils-credentials"
}

locals {
  environment_variables = jsondecode(data.aws_ssm_parameter.mt5_utils_credentials.value)
}

module "mt5-utils-chat-message-dynamodb" {
  source = "./dynamodb/mt5-utils-chat-messages"
}

module "iam" {
  source = "./iam"
}

module "mt5-utils-lambda" {
  source          = "./lambda/mt5-utils"
  lambda_role_arn = module.iam.mt5_utils_lambda_role_arn

  environment_variables = local.environment_variables

  aws_region = var.aws_region
}

module "lambda_authoriser" {
  source          = "./lambda/authoriser"
  lambda_role_arn = module.iam.mt5_utils_lambda_role_arn

  TELEGRAM_BOT_TOKEN = local.environment_variables.TELEGRAM_BOT_TOKEN
}

module "api_gateway" {
  source = "./api_gateway"

  lambda_function_arn     = module.mt5-utils-lambda.lambda_function_arn
  authoriser_function_arn = module.lambda_authoriser.lambda_function_arn
  aws_region              = var.aws_region
}

module "lambda_set-wehbook-for-telegram-bot-lambda" {
  source          = "./lambda/set_webhook_for_telegram_bot"
  lambda_role_arn = module.iam.mt5_utils_lambda_role_arn

  TELEGRAM_BOT_TOKEN        = local.environment_variables.TELEGRAM_BOT_TOKEN
  mt5_utils_api_gateway_url = module.api_gateway.mt5_utils_api_gateway_url
}
