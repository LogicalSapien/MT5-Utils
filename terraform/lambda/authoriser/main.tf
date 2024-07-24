resource "aws_lambda_function" "authoriser_lambda" {
  function_name = "mt5-utils-authoriser"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  role          = var.lambda_role_arn
  filename      = "../lambda/authoriser/authoriser-lambda.zip"
  timeout       = 30

  source_code_hash = filebase64sha256("../lambda/authoriser/authoriser-lambda.zip")

  environment {
    variables = {
      TELEGRAM_BOT_TOKEN = var.TELEGRAM_BOT_TOKEN
    }
  }
}

resource "aws_lambda_permission" "allow_api_gateway_to_invoke_authoriser" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authoriser_lambda.arn
  principal     = "apigateway.amazonaws.com"
}

variable "lambda_role_arn" {
  default = ""
}

variable "TELEGRAM_BOT_TOKEN" {
  type = string
}

output "lambda_function_arn" {
  value = aws_lambda_function.authoriser_lambda.arn
}
