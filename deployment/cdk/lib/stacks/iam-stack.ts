import * as cdk from 'aws-cdk-lib';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface IamStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
  readonly uploadBucket: s3.IBucket;
}

/**
 * IAM Stack - Creates IRSA role and GitHub Actions deploy role for promptstore
 *
 * Uses the EXISTING tapitriager EKS cluster's OIDC provider (not creating a new one).
 *
 * Resources created:
 * - IRSA Role for EKS pods to access S3 and Bedrock
 * - GitHub Actions deploy role (for CI/CD OIDC authentication)
 * - EKS access entry granting GitHub Actions role cluster admin access
 *
 * Permissions granted:
 * - S3: Upload/download files from promptstore bucket
 * - Bedrock: Invoke models (including cross-region inference profiles)
 * - ECR: Push/pull images (GitHub Actions role)
 * - EKS: Describe cluster + Kubernetes API access (GitHub Actions role)
 */
export class IamStack extends cdk.Stack {
  public readonly irsaRole: iam.Role;
  public readonly githubActionsRole: iam.Role;

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id, props);

    const { config, uploadBucket } = props;

    // =========================================================================
    // IRSA Role for EKS Pods (S3 and Bedrock Access)
    // =========================================================================

    // Build trust policy using existing EKS cluster's OIDC provider
    const oidcProviderArn = config.existingEksOidcProviderArn;
    const oidcIssuer = config.existingEksOidcIssuer;

    if (!oidcProviderArn || !oidcIssuer) {
      throw new Error(
        'existingEksOidcProviderArn and existingEksOidcIssuer must be set. ' +
        'These come from the tapitriager EKS cluster deployment.'
      );
    }

    const irsaConditions = new cdk.CfnJson(this, 'IrsaConditions', {
      value: {
        [`${oidcIssuer}:aud`]: 'sts.amazonaws.com',
        [`${oidcIssuer}:sub`]: `system:serviceaccount:${config.serviceAccountNamespace}:${config.serviceAccountName}`,
      },
    });

    this.irsaRole = new iam.Role(this, 'PromptstoreEksS3Role', {
      roleName: `${config.appName}-eks-s3-role`,
      description: `IAM role for ${config.appName} EKS pods to access S3 and Bedrock`,
      assumedBy: new iam.FederatedPrincipal(
        oidcProviderArn,
        {
          StringEquals: irsaConditions,
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    // S3 access policy
    const s3Policy = new iam.Policy(this, 'PromptstoreS3Policy', {
      policyName: `${config.appName}-eks-s3-policy`,
      statements: [
        new iam.PolicyStatement({
          sid: 'ListBucket',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:ListBucket',
          ],
          resources: [
            uploadBucket.bucketArn,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'ReadWriteObjects',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:PutObjectAcl',
            's3:DeleteObject',
          ],
          resources: [
            `${uploadBucket.bucketArn}/*`,
          ],
        }),
      ],
    });

    this.irsaRole.attachInlinePolicy(s3Policy);

    // Bedrock access policy
    const bedrockPolicy = new iam.Policy(this, 'PromptstoreBedrockPolicy', {
      policyName: `${config.appName}-eks-bedrock-policy`,
      statements: [
        new iam.PolicyStatement({
          sid: 'InvokeBedrockModels',
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock:InvokeModel',
            'bedrock:InvokeModelWithResponseStream',
          ],
          resources: [
            `arn:aws:bedrock:*:${cdk.Aws.ACCOUNT_ID}:inference-profile/*`,
            'arn:aws:bedrock:*::foundation-model/*',
          ],
        }),
        new iam.PolicyStatement({
          sid: 'MarketplaceSubscriptionAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            'aws-marketplace:ViewSubscriptions',
          ],
          resources: ['*'],
        }),
      ],
    });

    this.irsaRole.attachInlinePolicy(bedrockPolicy);

    // =========================================================================
    // GitHub Actions Deploy Role (OIDC Federation)
    // =========================================================================

    // Reuse or reference existing GitHub OIDC provider
    let githubOidcProvider: iam.IOpenIdConnectProvider;
    if (config.createGitHubOidcProvider) {
      githubOidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
        url: 'https://token.actions.githubusercontent.com',
        clientIds: ['sts.amazonaws.com'],
        thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
      });
    } else {
      if (!config.existingGitHubOidcProviderArn) {
        throw new Error('existingGitHubOidcProviderArn must be set when createGitHubOidcProvider is false');
      }
      githubOidcProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
        this,
        'ExistingGitHubOidcProvider',
        config.existingGitHubOidcProviderArn
      );
    }

    this.githubActionsRole = new iam.Role(this, 'GitHubActionsEKSDeployRole', {
      roleName: 'GitHubActionsPromptstoreDeployRole',
      description: 'Role assumed by GitHub Actions to deploy promptstore to EKS',
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(
        githubOidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${config.githubOrg}/${config.githubRepo}:*`,
          },
        }
      ),
    });

    // ECR permissions
    this.githubActionsRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ECRAuth',
      effect: iam.Effect.ALLOW,
      actions: ['ecr:GetAuthorizationToken'],
      resources: ['*'],
    }));

    this.githubActionsRole.addToPolicy(new iam.PolicyStatement({
      sid: 'ECRPushPull',
      effect: iam.Effect.ALLOW,
      actions: [
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:PutImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
        'ecr:DescribeImages',
        'ecr:ListImages',
      ],
      resources: [`arn:aws:ecr:${config.region}:${config.account}:repository/${config.ecrRepositoryName}`],
    }));

    // EKS permissions
    this.githubActionsRole.addToPolicy(new iam.PolicyStatement({
      sid: 'EKSAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'eks:DescribeCluster',
        'eks:ListClusters',
      ],
      resources: ['*'],
    }));

    // STS permissions (needed for OIDC)
    this.githubActionsRole.addToPolicy(new iam.PolicyStatement({
      sid: 'STSGetCallerIdentity',
      effect: iam.Effect.ALLOW,
      actions: ['sts:GetCallerIdentity'],
      resources: ['*'],
    }));

    // =========================================================================
    // EKS Access Entry (grants GitHub Actions role Kubernetes API access)
    // =========================================================================

    const eksCluster = eks.Cluster.fromClusterAttributes(this, 'ExistingEksCluster', {
      clusterName: config.existingEksClusterName,
    });

    new eks.AccessEntry(this, 'GitHubActionsEksAccessEntry', {
      cluster: eksCluster,
      principal: this.githubActionsRole.roleArn,
      accessPolicies: [
        eks.AccessPolicy.fromAccessPolicyName('AmazonEKSClusterAdminPolicy', {
          accessScopeType: eks.AccessScopeType.CLUSTER,
        }),
      ],
    });

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'IrsaRoleArn', {
      value: this.irsaRole.roleArn,
      description: 'IRSA Role ARN for EKS pods',
      exportName: `${this.stackName}-IRSA-ROLE-ARN`,
    });

    new cdk.CfnOutput(this, 'ServiceAccountAnnotation', {
      value: `eks.amazonaws.com/role-arn: ${this.irsaRole.roleArn}`,
      description: 'Annotation to add to Kubernetes ServiceAccount',
    });

    new cdk.CfnOutput(this, 'GitHubActionsRoleArn', {
      value: this.githubActionsRole.roleArn,
      description: 'GitHub Actions deploy role ARN',
      exportName: `${this.stackName}-GITHUB-ACTIONS-ROLE-ARN`,
    });
  }
}
