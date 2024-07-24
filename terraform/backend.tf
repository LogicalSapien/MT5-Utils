terraform {
  backend "s3" {
    bucket         = "terraform-mt5-utils-state"
    key            = "terraform/terraform.tfstate"
    region         = "eu-west-2"
    dynamodb_table = "terraform-mt5-utils-locks"
  }
}