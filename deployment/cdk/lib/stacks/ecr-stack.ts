import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface EcrStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

/**
 * ECR Stack - Creates ECR repository for promptstore container images
 *
 * Resources created:
 * - ECR Repository (europalabs/promptstore)
 *
 * Features:
 * - Image scanning on push
 * - Lifecycle policies for image cleanup
 * - Tag mutability configuration (per environment)
 */
export class EcrStack extends cdk.Stack {
  public readonly ecrRepository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    const { config } = props;

    if (config.createEcrRepository) {
      const repository = new ecr.Repository(this, 'PromptstoreRepository', {
        repositoryName: config.ecrRepositoryName,

        imageScanOnPush: config.ecrScanOnPush,

        imageTagMutability: config.ecrImageTagMutability === 'IMMUTABLE'
          ? ecr.TagMutability.IMMUTABLE
          : ecr.TagMutability.MUTABLE,

        encryption: ecr.RepositoryEncryption.AES_256,

        removalPolicy: cdk.RemovalPolicy.RETAIN,

        lifecycleRules: [
          {
            description: 'Keep last N tagged images',
            rulePriority: 1,
            tagStatus: ecr.TagStatus.TAGGED,
            tagPrefixList: ['sha', 'v', 'testing', 'staging', 'production'],
            maxImageCount: config.ecrImageRetentionCount,
          },
          {
            description: 'Delete untagged images after 1 day',
            rulePriority: 2,
            tagStatus: ecr.TagStatus.UNTAGGED,
            maxImageAge: cdk.Duration.days(1),
          },
        ],
      });

      this.ecrRepository = repository;

      new cdk.CfnOutput(this, 'EcrRepositoryName', {
        value: repository.repositoryName,
        description: 'ECR Repository Name',
        exportName: `${this.stackName}-ECR-REPOSITORY-NAME`,
      });

      new cdk.CfnOutput(this, 'EcrRepositoryUri', {
        value: repository.repositoryUri,
        description: 'ECR Repository URI',
        exportName: `${this.stackName}-ECR-REPOSITORY-URI`,
      });
    } else {
      if (!config.existingEcrRepositoryArn) {
        throw new Error('existingEcrRepositoryArn must be set when createEcrRepository is false');
      }

      this.ecrRepository = ecr.Repository.fromRepositoryArn(
        this,
        'ExistingEcrRepository',
        config.existingEcrRepositoryArn
      );

      new cdk.CfnOutput(this, 'EcrRepositoryName', {
        value: this.ecrRepository.repositoryName,
        description: 'ECR Repository Name (Imported)',
      });
    }
  }
}
