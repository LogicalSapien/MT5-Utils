resource "aws_dynamodb_table" "mt5_utils_chat_messages_table" {
  name         = "mt5-utils-chat-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "messageId"

  attribute {
    name = "messageId"
    type = "N"
  }

  attribute {
    name = "username"
    type = "S"
  }

  global_secondary_index {
    name            = "username-index"
    hash_key        = "username"
    range_key       = "messageId"
    projection_type = "ALL"
  }
}
