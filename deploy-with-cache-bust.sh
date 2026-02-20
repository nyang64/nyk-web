#!/bin/bash

# Enhanced deployment script with cache busting
BUCKET_NAME="www.nyklabs.com"
DISTRIBUTION_ID=""  # Add your CloudFront distribution ID here

echo "🏗️  Building the application..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo ""
echo "📤 Uploading to S3 with proper cache headers..."

# Step 1: Delete old files from S3 to ensure clean state
echo "🗑️  Clearing old files from S3..."
aws s3 rm s3://$BUCKET_NAME/ --recursive --exclude "*.png" --exclude "*.jpg" --exclude "*.ico"

# Step 2: Upload static assets with long cache (images, fonts, etc.)
echo "📷 Uploading static assets..."
aws s3 sync ./build/client s3://$BUCKET_NAME \
  --exclude "*.html" \
  --exclude "*.js" \
  --exclude "*.css" \
  --cache-control "public, max-age=31536000, immutable"

# Step 3: Upload JS/CSS assets with long cache AND immutable
echo "📦 Uploading JS and CSS assets..."
aws s3 sync ./build/client/assets s3://$BUCKET_NAME/assets \
  --cache-control "public, max-age=31536000, immutable" \
  --content-type "application/javascript"

# Step 4: Upload index.html with NO cache
echo "📄 Uploading index.html (no cache)..."
aws s3 cp ./build/client/index.html s3://$BUCKET_NAME/index.html \
  --cache-control "public, max-age=0, no-cache, no-store, must-revalidate" \
  --content-type "text/html"

echo ""
echo "✅ Files uploaded successfully!"

# Step 5: Invalidate CloudFront cache
if [ -z "$DISTRIBUTION_ID" ]; then
  echo ""
  echo "⚠️  DISTRIBUTION_ID not set!"
  echo "Please add your CloudFront Distribution ID to this script."
  echo "You can find it in the CloudFront console."
  echo ""
  echo "For now, manually create an invalidation:"
  echo "aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths \"/*\""
else
  echo ""
  echo "🔄 Invalidating CloudFront cache..."
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)
  
  echo "✅ Invalidation created: $INVALIDATION_ID"
  echo "⏳ Waiting for invalidation to complete (this may take 2-5 minutes)..."
  
  aws cloudfront wait invalidation-completed \
    --distribution-id $DISTRIBUTION_ID \
    --id $INVALIDATION_ID
  
  echo "✅ Invalidation completed!"
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "🌐 Your site: https://www.nyklabs.com"
echo ""
echo "⚠️  IMPORTANT: Test in incognito/private browsing mode!"
echo "Regular browser windows may still have cached content."
echo ""
echo "📋 Testing checklist:"
echo "  1. Open incognito/private window"
echo "  2. Visit https://www.nyklabs.com"
echo "  3. Test each navigation link:"
echo "     - Product"
echo "     - Hashed Lierre"
echo "     - Registration"
echo "     - FAQ"
echo "     - About"
echo "  4. Refresh each page directly (F5)"
echo "  5. Check browser dev tools > Network tab for 200 status codes"
echo ""
