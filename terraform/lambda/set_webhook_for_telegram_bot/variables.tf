variable "lambda_role_arn" {
  default = ""
}

# env variable values from ssm
variable "TELEGRAM_BOT_TOKEN" {}

variable "mt5_utils_api_gateway_url" {
  type = string
}
