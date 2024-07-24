resource "aws_iam_role" "mt5_utils_lambda_role" {
  name = "mt5-utils-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "mt5_utils_lambda_dynamodb_policy" {
  role       = aws_iam_role.mt5_utils_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_role_policy_attachment" "mt5_utils_lambda_basic_execution" {
  role       = aws_iam_role.mt5_utils_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
