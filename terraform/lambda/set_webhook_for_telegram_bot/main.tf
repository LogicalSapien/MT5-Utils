resource "aws_lambda_function" "set_webhook_function" {
  function_name = "set-webhook-for-telegram-bot-lambda"
  filename      = "../lambda/set-webhook-for-telegram-bot/set-webhook-for-telegram-bot-lambda.zip"
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  role          = var.lambda_role_arn
  timeout       = 60

  source_code_hash = filebase64sha256("../lambda/set-webhook-for-telegram-bot/set-webhook-for-telegram-bot-lambda.zip")

  environment {
    variables = {
      TELEGRAM_BOT_TOKEN = var.TELEGRAM_BOT_TOKEN
      API_GATEWAY_URL    = var.mt5_utils_api_gateway_url
    }
  }
}

resource "aws_lambda_permission" "apigateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.set_webhook_function.arn
  principal     = "apigateway.amazonaws.com"
}

resource "null_resource" "invoke_set_webhook" {
  provisioner "local-exec" {
    command = "aws lambda invoke --function-name ${aws_lambda_function.set_webhook_function.function_name} /dev/null"
  }

  triggers = {
    mt5_utils_api_gateway_url = var.mt5_utils_api_gateway_url
  }
}
