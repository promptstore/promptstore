/**
 * Environment configuration for promptstore CDK stacks.
 *
 * Promptstore deploys into the EXISTING tapitriager EKS cluster
 * (shared VPC, EKS, ALB controller) but with its own:
 * - Kubernetes namespace (promptstore)
 * - RDS PostgreSQL database
 * - ElastiCache Redis cluster
 * - ECR repository
 * - S3 bucket
 * - Cognito User Pool
 * - IRSA role
 */

export interface EnvironmentConfig {
  // AWS Account Settings
  readonly account: string;
  readonly region: string;

  // Application Configuration
  readonly appName: string;
  readonly namespace: string;

  // --- Imported from tapitriager infrastructure ---

  // VPC (shared with tapitriager)
  readonly existingVpcId: string;
  readonly existingEksSgId: string;
  readonly existingRdsSgId: string;

  // EKS (from tapitriager cluster)
  readonly existingEksClusterName: string;
  readonly existingEksOidcIssuer: string;
  readonly existingEksOidcProviderArn: string;

  // --- Promptstore-specific resources ---

  // RDS Configuration
  readonly rdsInstanceClass: string;
  readonly rdsAllocatedStorage: number;
  readonly rdsMaxAllocatedStorage: number;
  readonly rdsDatabaseName: string;
  readonly rdsUsername: string;

  // RDS Proxy Configuration
  readonly rdsProxyEnabled: boolean;

  // ElastiCache Redis Configuration
  readonly elasticacheNodeType: string;
  readonly elasticacheNumCacheNodes: number;
  readonly elasticacheEngineVersion: string;
  readonly createElastiCache: boolean;

  // S3 Configuration
  readonly s3BucketPrefix: string;
  readonly uploadBucketName?: string;
  readonly bucketEncryptionType: 'SSE-S3' | 'KMS';
  readonly bucketVersioningEnabled: boolean;
  readonly uploadLifecycleDays?: number;
  readonly createUploadBucket: boolean;
  readonly existingUploadBucketName?: string;

  // ECR Configuration
  readonly ecrRepositoryName: string;
  readonly ecrImageTagMutability: 'MUTABLE' | 'IMMUTABLE';
  readonly ecrScanOnPush: boolean;
  readonly ecrImageRetentionCount: number;
  readonly createEcrRepository: boolean;
  readonly existingEcrRepositoryArn?: string;

  // GitHub OIDC Configuration
  readonly githubOrg: string;
  readonly githubRepo: string;
  readonly createGitHubOidcProvider: boolean;
  readonly existingGitHubOidcProviderArn?: string;

  // Service Account Configuration (for IRSA)
  readonly serviceAccountName: string;
  readonly serviceAccountNamespace: string;

  // Cognito Configuration
  readonly cognitoDomainPrefix: string;
  readonly cognitoCallbackUrls: string[];
  readonly cognitoLogoutUrls: string[];
  readonly cognitoSelfSignUpEnabled: boolean;

  // ACM Certificate Configuration
  readonly acmDomainName: string;
  readonly acmSubjectAlternativeNames?: string[];
}

/**
 * Testing environment configuration
 */
const testing: EnvironmentConfig = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '',
  region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',

  appName: 'promptstore',
  namespace: 'promptstore',

  // Imported tapitriager infrastructure
  existingVpcId: process.env.EXISTING_VPC_ID || '',
  existingEksSgId: process.env.EXISTING_EKS_SG_ID || '',
  existingRdsSgId: process.env.EXISTING_RDS_SG_ID || '',
  existingEksClusterName: process.env.EXISTING_EKS_CLUSTER_NAME || 'tapitriager',
  existingEksOidcIssuer: process.env.EXISTING_EKS_OIDC_ISSUER || '',
  existingEksOidcProviderArn: process.env.EXISTING_EKS_OIDC_PROVIDER_ARN || '',

  // RDS Configuration
  rdsInstanceClass: 'db.t3.medium',
  rdsAllocatedStorage: 20,
  rdsMaxAllocatedStorage: 100,
  rdsDatabaseName: 'promptstore',
  rdsUsername: 'dbadmin',

  // RDS Proxy
  rdsProxyEnabled: false,

  // ElastiCache Redis
  elasticacheNodeType: 'cache.t3.small',
  elasticacheNumCacheNodes: 1,
  elasticacheEngineVersion: '7.0',
  createElastiCache: true,

  // S3 Configuration
  s3BucketPrefix: process.env.S3_BUCKET_PREFIX || 'promptstore-testing',
  uploadBucketName: process.env.UPLOAD_BUCKET_NAME || 'promptstore-testing-data-ap-southeast-2',
  bucketEncryptionType: 'SSE-S3',
  bucketVersioningEnabled: false,
  uploadLifecycleDays: 30,
  createUploadBucket: true,

  // ECR Configuration
  ecrRepositoryName: process.env.ECR_REPOSITORY_NAME || 'europalabs/promptstore',
  ecrImageTagMutability: 'MUTABLE',
  ecrScanOnPush: true,
  ecrImageRetentionCount: 5,
  createEcrRepository: true,
  existingEcrRepositoryArn: process.env.ECR_REPOSITORY_ARN,

  // GitHub OIDC - reuse the provider already created by tapitriager
  githubOrg: process.env.GITHUB_ORG || '',
  githubRepo: process.env.GITHUB_REPO || 'promptstore',
  createGitHubOidcProvider: false,
  existingGitHubOidcProviderArn: process.env.EXISTING_GITHUB_OIDC_PROVIDER_ARN,

  // Service Account for IRSA
  serviceAccountName: 'promptstore',
  serviceAccountNamespace: 'promptstore',

  // Cognito
  cognitoDomainPrefix: 'promptstore-testing',
  cognitoCallbackUrls: [
    'http://localhost:3001/callback',
    'https://testing.openaiplatform.com/callback',
  ],
  cognitoLogoutUrls: [
    'http://localhost:3001',
    'https://testing.openaiplatform.com',
  ],
  cognitoSelfSignUpEnabled: true,

  // ACM Certificate
  acmDomainName: '*.openaiplatform.com',
  acmSubjectAlternativeNames: ['openaiplatform.com'],
};

/**
 * Staging environment configuration
 */
const staging: EnvironmentConfig = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '',
  region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',

  appName: 'promptstore',
  namespace: 'promptstore',

  existingVpcId: process.env.EXISTING_VPC_ID || '',
  existingEksSgId: process.env.EXISTING_EKS_SG_ID || '',
  existingRdsSgId: process.env.EXISTING_RDS_SG_ID || '',
  existingEksClusterName: process.env.EXISTING_EKS_CLUSTER_NAME || 'tapitriager',
  existingEksOidcIssuer: process.env.EXISTING_EKS_OIDC_ISSUER || '',
  existingEksOidcProviderArn: process.env.EXISTING_EKS_OIDC_PROVIDER_ARN || '',

  rdsInstanceClass: 'db.t3.medium',
  rdsAllocatedStorage: 20,
  rdsMaxAllocatedStorage: 100,
  rdsDatabaseName: 'promptstore',
  rdsUsername: 'dbadmin',

  rdsProxyEnabled: true,

  // ElastiCache Redis
  elasticacheNodeType: 'cache.t3.medium',
  elasticacheNumCacheNodes: 2,
  elasticacheEngineVersion: '7.0',
  createElastiCache: true,

  // S3 Configuration
  s3BucketPrefix: process.env.S3_BUCKET_PREFIX || 'promptstore-staging',
  uploadBucketName: process.env.UPLOAD_BUCKET_NAME || 'promptstore-staging-data-ap-southeast-2',
  bucketEncryptionType: 'SSE-S3',
  bucketVersioningEnabled: true,
  uploadLifecycleDays: 60,
  createUploadBucket: true,

  ecrRepositoryName: process.env.ECR_REPOSITORY_NAME || 'europalabs/promptstore',
  ecrImageTagMutability: 'MUTABLE',
  ecrScanOnPush: true,
  ecrImageRetentionCount: 10,
  createEcrRepository: true,
  existingEcrRepositoryArn: process.env.ECR_REPOSITORY_ARN,

  githubOrg: process.env.GITHUB_ORG || '',
  githubRepo: process.env.GITHUB_REPO || 'promptstore',
  createGitHubOidcProvider: false,
  existingGitHubOidcProviderArn: process.env.EXISTING_GITHUB_OIDC_PROVIDER_ARN,

  serviceAccountName: 'promptstore',
  serviceAccountNamespace: 'promptstore',

  // Cognito
  cognitoDomainPrefix: 'promptstore-staging',
  cognitoCallbackUrls: [
    'https://staging.openaiplatform.com/callback',
  ],
  cognitoLogoutUrls: [
    'https://staging.openaiplatform.com',
  ],
  cognitoSelfSignUpEnabled: false,

  acmDomainName: '*.openaiplatform.com',
  acmSubjectAlternativeNames: ['openaiplatform.com'],
};

/**
 * Production environment configuration
 */
const production: EnvironmentConfig = {
  account: process.env.CDK_DEFAULT_ACCOUNT || '',
  region: process.env.CDK_DEFAULT_REGION || 'ap-southeast-2',

  appName: 'promptstore',
  namespace: 'promptstore',

  existingVpcId: process.env.EXISTING_VPC_ID || '',
  existingEksSgId: process.env.EXISTING_EKS_SG_ID || '',
  existingRdsSgId: process.env.EXISTING_RDS_SG_ID || '',
  existingEksClusterName: process.env.EXISTING_EKS_CLUSTER_NAME || 'tapitriager',
  existingEksOidcIssuer: process.env.EXISTING_EKS_OIDC_ISSUER || '',
  existingEksOidcProviderArn: process.env.EXISTING_EKS_OIDC_PROVIDER_ARN || '',

  rdsInstanceClass: 'db.t3.medium',
  rdsAllocatedStorage: 20,
  rdsMaxAllocatedStorage: 100,
  rdsDatabaseName: 'promptstore',
  rdsUsername: 'dbadmin',

  rdsProxyEnabled: true,

  // ElastiCache Redis
  elasticacheNodeType: 'cache.t3.medium',
  elasticacheNumCacheNodes: 2,
  elasticacheEngineVersion: '7.0',
  createElastiCache: true,

  // S3 Configuration
  s3BucketPrefix: process.env.S3_BUCKET_PREFIX || 'promptstore-production',
  uploadBucketName: process.env.UPLOAD_BUCKET_NAME || 'promptstore-production-data-ap-southeast-2',
  bucketEncryptionType: 'SSE-S3',
  bucketVersioningEnabled: true,
  uploadLifecycleDays: 90,
  createUploadBucket: true,

  ecrRepositoryName: process.env.ECR_REPOSITORY_NAME || 'europalabs/promptstore',
  ecrImageTagMutability: 'MUTABLE',
  ecrScanOnPush: true,
  ecrImageRetentionCount: 20,
  createEcrRepository: true,
  existingEcrRepositoryArn: process.env.ECR_REPOSITORY_ARN,

  githubOrg: process.env.GITHUB_ORG || '',
  githubRepo: process.env.GITHUB_REPO || 'promptstore',
  createGitHubOidcProvider: false,
  existingGitHubOidcProviderArn: process.env.EXISTING_GITHUB_OIDC_PROVIDER_ARN,

  serviceAccountName: 'promptstore',
  serviceAccountNamespace: 'promptstore',

  // Cognito
  cognitoDomainPrefix: 'promptstore',
  cognitoCallbackUrls: [
    'https://openaiplatform.com/callback',
  ],
  cognitoLogoutUrls: [
    'https://openaiplatform.com',
  ],
  cognitoSelfSignUpEnabled: false,

  acmDomainName: '*.openaiplatform.com',
  acmSubjectAlternativeNames: ['openaiplatform.com'],
};

export const environments: Record<string, EnvironmentConfig> = {
  testing,
  staging,
  production,
};

export function getEnvironmentConfig(envName: string): EnvironmentConfig {
  const config = environments[envName];
  if (!config) {
    throw new Error(
      `Unknown environment: ${envName}. Available environments: ${Object.keys(environments).join(', ')}`
    );
  }
  return config;
}
