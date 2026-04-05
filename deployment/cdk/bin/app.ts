#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { S3Stack } from '../lib/stacks/s3-stack';
import { EcrStack } from '../lib/stacks/ecr-stack';
import { RdsStack } from '../lib/stacks/rds-stack';
import { RdsProxyStack } from '../lib/stacks/rds-proxy-stack';
import { ElastiCacheStack } from '../lib/stacks/elasticache-stack';
import { IamStack } from '../lib/stacks/iam-stack';
import { CognitoStack } from '../lib/stacks/cognito-stack';
import { AcmStack } from '../lib/stacks/acm-stack';
import { getEnvironmentConfig } from '../lib/config/environments';

/**
 * CDK App Entry Point for promptstore
 *
 * Promptstore deploys into the EXISTING tapitriager EKS cluster.
 * This CDK app creates only the promptstore-specific resources:
 *
 * Shared (imported from tapitriager):
 * - VPC, subnets, NAT gateway
 * - EKS cluster, node groups, ALB controller
 * - Security groups (EKS, RDS)
 * - EKS OIDC provider (for IRSA)
 * - GitHub OIDC provider (for CI/CD)
 *
 * Created by this app:
 * 1. EcrStack - ECR repository for container images
 * 2. S3Stack - S3 bucket for application data (replaces MinIO)
 * 3. CognitoStack - User Pool, App Client, Domain, Groups
 * 4. AcmStack - TLS certificate for ALB ingress
 * 5. RdsStack - PostgreSQL database (in shared VPC)
 * 6. ElastiCacheStack - Redis cluster for caching (in shared VPC)
 * 7. RdsProxyStack - RDS Proxy for connection pooling (optional)
 * 8. IamStack - IRSA role + GitHub Actions deploy role
 *
 * Usage:
 *   # Load environment variables first
 *   source load-env.sh .env.testing
 *
 *   # Deploy all stacks
 *   cdk deploy --all -c environment=testing
 *
 *   # Deploy specific stack
 *   cdk deploy PromptstoreRdsStack -c environment=testing
 *
 *   # Preview changes
 *   cdk diff --all -c environment=testing
 */

const app = new cdk.App();

// Get environment name from context (default: testing)
const envName = app.node.tryGetContext('environment') ?? 'testing';

// Load environment configuration
const config = getEnvironmentConfig(envName);

// Validate required configuration values
const requiredValues = [
  { key: 'account', value: config.account },
  { key: 'region', value: config.region },
  { key: 'existingVpcId', value: config.existingVpcId },
  { key: 'existingEksSgId', value: config.existingEksSgId },
  { key: 'existingRdsSgId', value: config.existingRdsSgId },
  { key: 'existingEksOidcIssuer', value: config.existingEksOidcIssuer },
  { key: 'existingEksOidcProviderArn', value: config.existingEksOidcProviderArn },
  { key: 'githubOrg', value: config.githubOrg },
  { key: 'githubRepo', value: config.githubRepo },
];

const missingValues = requiredValues.filter(v => !v.value);

if (missingValues.length > 0) {
  console.warn('\nWarning: The following configuration values are missing:');
  missingValues.forEach(v => console.warn(`   - ${v.key}`));
  console.warn('\nEnsure you have loaded the environment file:');
  console.warn(`   source load-env.sh .env.${envName}\n`);
}

// AWS environment for stacks
const env: cdk.Environment = {
  account: config.account,
  region: config.region,
};

console.log(`\nDeploying promptstore to environment: ${envName}`);
console.log(`   Account: ${config.account}`);
console.log(`   Region: ${config.region}`);
console.log(`   VPC: ${config.existingVpcId}`);
console.log(`   Namespace: ${config.namespace}\n`);

// Stack naming convention: Promptstore<Resource>Stack
const stackPrefix = 'Promptstore';

// Common tags for all stacks
const commonTags = {
  Environment: envName,
  Project: config.appName,
  ManagedBy: 'CDK',
};

// ============================================================================
// Layer 1: Foundation Stacks (no dependencies on imported infrastructure)
// ============================================================================

// ECR Stack
const ecrStack = new EcrStack(app, `${stackPrefix}EcrStack`, {
  env,
  config,
  description: 'ECR repository for promptstore container images',
  tags: commonTags,
});

// S3 Stack
const s3Stack = new S3Stack(app, `${stackPrefix}S3Stack`, {
  env,
  config,
  description: 'S3 bucket for promptstore data and uploads',
  tags: commonTags,
});

// ACM Certificate Stack
const acmStack = new AcmStack(app, `${stackPrefix}AcmStack`, {
  env,
  config,
  description: 'TLS certificate for promptstore ALB ingress',
  tags: commonTags,
});

// Cognito Stack
const cognitoStack = new CognitoStack(app, `${stackPrefix}CognitoStack`, {
  env,
  config,
  description: 'Cognito User Pool for promptstore authentication',
  tags: commonTags,
});

// ============================================================================
// Layer 2: RDS and ElastiCache (look up imported VPC internally)
// ============================================================================

const rdsStack = new RdsStack(app, `${stackPrefix}RdsStack`, {
  env,
  config,
  description: 'PostgreSQL RDS database for promptstore',
  tags: commonTags,
});

let elastiCacheStack: ElastiCacheStack | undefined;
if (config.createElastiCache) {
  elastiCacheStack = new ElastiCacheStack(app, `${stackPrefix}ElastiCacheStack`, {
    env,
    config,
    description: 'ElastiCache Redis cluster for promptstore caching',
    tags: commonTags,
  });
}

// ============================================================================
// Layer 2.5: RDS Proxy (depends on RDS, optional)
// ============================================================================

let rdsProxyStack: RdsProxyStack | undefined;
if (config.rdsProxyEnabled) {
  rdsProxyStack = new RdsProxyStack(app, `${stackPrefix}RdsProxyStack`, {
    env,
    config,
    databaseInstance: rdsStack.databaseInstance,
    databaseSecret: rdsStack.databaseSecret,
    description: 'RDS Proxy for promptstore connection pooling',
    tags: commonTags,
  });
  rdsProxyStack.addDependency(rdsStack);
}

// ============================================================================
// Layer 3: IAM Stack (IRSA + GitHub Actions role)
// ============================================================================

const iamStack = new IamStack(app, `${stackPrefix}IamStack`, {
  env,
  config,
  uploadBucket: s3Stack.uploadBucket,
  description: 'IAM roles for promptstore IRSA and GitHub Actions OIDC',
  tags: commonTags,
});
iamStack.addDependency(s3Stack);

// Synthesize the app
app.synth();
