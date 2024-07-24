output "mt5_utils_api_gateway_url" {
  value = aws_apigatewayv2_stage.default.invoke_url
}
