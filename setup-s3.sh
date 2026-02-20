#!/bin/bash

# Complete S3 SPA Setup Script
BUCKET_NAME="www.nyklabs.com"

echo "🚀 Setting up S3 for SPA hosting..."
echo "Bucket: $BUCKET_NAME"
echo ""

# Step 1: Enable static website hosting
echo "1️⃣  Enabling static website hosting..."
aws s3 website s3://$BUCKET_NAME \
  --index-document index.html \
  --error-document index.html

# Step 2: Remove public access block
echo "2️⃣  Removing public access block..."
aws s3api delete-public-access-block --bucket $BUCKET_NAME

# Step 3: Set bucket policy for public read
echo "3️⃣  Setting bucket policy for public read..."
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::'$BUCKET_NAME'/*"
  }]
}'

# Step 4: Upload files with proper cache headers
echo "4️⃣  Uploading files..."

# Upload all files except index.html with long cache
aws s3 sync ./build/client s3://$BUCKET_NAME \
  --delete \
  --cache-control 'public, max-age=31536000' \
  --exclude 'index.html'

# Upload index.html with no cache (so routing updates work)
aws s3 cp ./build/client/index.html s3://$BUCKET_NAME/index.html \
  --cache-control 'public, max-age=0, must-revalidate'

echo ""
echo "✅ Done! Your site should be available at:"
echo "   http://$BUCKET_NAME.s3-website-us-west-2.amazonaws.com"
echo ""
echo "🔍 Test by visiting the URL above in an incognito/private window"
echo "   (to avoid browser cache issues)"
echo ""
