resource "aws_lambda_function" "mt5_utils_lambda" {
  function_name                  = "mt5-utils-lambda"
  filename                       = "../lambda/mt5-utils/mt5-utils-lambda.zip"
  handler                        = "index.handler"
  runtime                        = "nodejs20.x"
  role                           = var.lambda_role_arn
  timeout                        = 600
  memory_size                    = 256
  reserved_concurrent_executions = 1

  source_code_hash = filebase64sha256("../lambda/mt5-utils/mt5-utils-lambda.zip")

  environment {
    variables = local.merged_variables
  }

}

resource "aws_lambda_permission" "allow_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mt5_utils_lambda.arn
  principal     = "apigateway.amazonaws.com"
}


locals {
  # Merge with default variables if necessary
  merged_variables = merge(
    {
      # Add any default environment variables here if needed
    },
    {for key, value in var.environment_variables : key => value != "" ? value : null}
  )
}
