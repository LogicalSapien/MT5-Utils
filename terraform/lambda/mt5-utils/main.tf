resource "aws_lambda_function" "mt5_utils_lambda" {
  function_name                  = "mt5-utils-lambda"
  s3_bucket                      = "mt5-utils-lambdas"
  s3_key                         = "mt5-utils-lambda.zip"
  handler                        = "index.handler"
  runtime                        = "nodejs18.x"
  role                           = var.lambda_role_arn
  timeout                        = 600
  memory_size                    = 512
  reserved_concurrent_executions = 1

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
