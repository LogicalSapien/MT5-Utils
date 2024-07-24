resource "aws_apigatewayv2_api" "mt5_utils_api" {
  name          = "mt5-utils-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "mt5_utils_api_lambda_integration" {
  api_id                 = aws_apigatewayv2_api.mt5_utils_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.lambda_function_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_authorizer" "mt5_utils_telegram_bot_token_authoriser" {
  name                              = "telegramTokenAuthoriser"
  api_id                            = aws_apigatewayv2_api.mt5_utils_api.id
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${var.authoriser_function_arn}/invocations"
  authorizer_payload_format_version = "2.0"

  identity_sources = ["$request.querystring.token"]
}

resource "aws_apigatewayv2_route" "t5_utils_api_telegram_webhook" {
  api_id    = aws_apigatewayv2_api.mt5_utils_api.id
  route_key = "POST /webhook"
  target    = "integrations/${aws_apigatewayv2_integration.mt5_utils_api_lambda_integration.id}"

  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.mt5_utils_telegram_bot_token_authoriser.id
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.mt5_utils_api.id
  name        = "$default"
  auto_deploy = true
}
