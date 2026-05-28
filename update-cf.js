const { execSync } = require('child_process');
const fs = require('fs');

// 1. Get current config
console.log('Getting config...');
const output = execSync('aws cloudfront get-distribution-config --id E2VL1KOTKZFQXZ').toString();
const config = JSON.parse(output);
const eTag = config.ETag;
let distConfig = config.DistributionConfig;

// 2. Update Aliases
distConfig.Aliases = {
    "Quantity": 1,
    "Items": ["tranminhquang.me"]
};

// 3. Update ViewerCertificate
distConfig.ViewerCertificate = {
    "CloudFrontDefaultCertificate": false,
    "ACMCertificateArn": "arn:aws:acm:us-east-1:201023212626:certificate/88eba402-e58a-4f35-a8aa-8aae4f5f6bb7",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021",
    "Certificate": "arn:aws:acm:us-east-1:201023212626:certificate/88eba402-e58a-4f35-a8aa-8aae4f5f6bb7",
    "CertificateSource": "acm"
};

// 4. Save to file
fs.writeFileSync('cf-config.json', JSON.stringify(distConfig, null, 2));
console.log('Saved to cf-config.json. ETag is ' + eTag);

// 5. Update distribution
console.log('Updating distribution...');
const updateOut = execSync(`aws cloudfront update-distribution --id E2VL1KOTKZFQXZ --if-match ${eTag} --distribution-config file://cf-config.json`).toString();
console.log('Done!');
