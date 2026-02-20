#!/bin/bash

# S3 SPA Deployment & Verification Script
# Replace YOUR_BUCKET_NAME with your actual bucket name

BUCKET_NAME="www.nyklabs.com"
REGION="us-west-2"  # Change to your region

echo "🔍 S3 SPA Deployment Checklist"
echo "================================"
echo ""

# 1. Check if static website hosting is enabled
echo "1️⃣  Checking static website hosting configuration..."
aws s3api get-bucket-website --bucket $BUCKET_NAME 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Static website hosting is ENABLED"
else
  echo "❌ Static website hosting is NOT enabled"
  echo "   Run: aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html"
fi
echo ""

# 2. Check bucket policy
echo "2️⃣  Checking bucket policy for public read access..."
aws s3api get-bucket-policy --bucket $BUCKET_NAME 2>/dev/null | grep -q "GetObject"
if [ $? -eq 0 ]; then
  echo "✅ Bucket policy exists"
else
  echo "❌ No public read policy found"
  echo "   You need to add a bucket policy for public access"
fi
echo ""

# 3. Check if public access block is preventing access
echo "3️⃣  Checking public access block settings..."
aws s3api get-public-access-block --bucket $BUCKET_NAME 2>/dev/null
echo ""

# 4. List files in bucket
echo "4️⃣  Files in bucket:"
aws s3 ls s3://$BUCKET_NAME/ --recursive
echo ""

# 5. Show website endpoint
echo "5️⃣  Your S3 Website Endpoints:"
echo "   http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo "   http://$BUCKET_NAME.s3-website.$REGION.amazonaws.com"
echo ""

echo "6️⃣  Quick Fix Commands:"
echo ""
echo "# Enable static website hosting:"
echo "aws s3 website s3://$BUCKET_NAME --index-document index.html --error-document index.html"
echo ""
echo "# Remove public access block (if needed):"
echo "aws s3api delete-public-access-block --bucket $BUCKET_NAME"
echo ""
echo "# Set bucket policy for public read:"
echo 'aws s3api put-bucket-policy --bucket '$BUCKET_NAME' --policy '"'"'{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*"
  }]
}'"'"
echo ""
echo "# Upload files:"
echo "aws s3 sync ./build/client s3://$BUCKET_NAME --delete --cache-control 'public, max-age=31536000' --exclude 'index.html'"
echo "aws s3 cp ./build/client/index.html s3://$BUCKET_NAME/index.html --cache-control 'public, max-age=0, must-revalidate'"
echo ""
