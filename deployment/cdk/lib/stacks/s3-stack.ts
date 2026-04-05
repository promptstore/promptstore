import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface S3StackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

/**
 * S3 Stack - Creates S3 bucket for promptstore data and uploads
 *
 * Replaces MinIO used in local development.
 *
 * Resources created:
 * - Upload/Data S3 Bucket (private)
 *   - Documents (documents/*)
 *   - Images (images/*)
 *   - Application data
 *
 * Features:
 * - Server-side encryption (SSE-S3)
 * - Versioning (configurable per environment)
 * - CORS configuration
 * - Lifecycle policies for cost optimization
 * - Block all public access
 */
export class S3Stack extends cdk.Stack {
  public readonly uploadBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id, props);

    const { config } = props;

    if (config.createUploadBucket) {
      const uploadBucketName = config.uploadBucketName ||
        `${config.s3BucketPrefix}-data-${config.region}`;

      const uploadBucket = new s3.Bucket(this, 'UploadBucket', {
        bucketName: uploadBucketName,

        encryption: config.bucketEncryptionType === 'KMS'
          ? s3.BucketEncryption.KMS_MANAGED
          : s3.BucketEncryption.S3_MANAGED,

        versioned: config.bucketVersioningEnabled,

        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,

        enforceSSL: true,

        removalPolicy: cdk.RemovalPolicy.RETAIN,

        cors: [
          {
            allowedMethods: [
              s3.HttpMethods.GET,
              s3.HttpMethods.PUT,
              s3.HttpMethods.POST,
              s3.HttpMethods.HEAD,
            ],
            allowedOrigins: ['*'],
            allowedHeaders: ['*'],
            exposedHeaders: [
              'Content-Type',
              'Content-Length',
              'Content-Disposition',
              'ETag',
            ],
            maxAge: 3000,
          },
        ],

        lifecycleRules: [
          {
            id: 'DeleteOldUploads',
            enabled: true,
            prefix: 'uploads/',
            expiration: cdk.Duration.days(config.uploadLifecycleDays || 90),
          },
        ],
      });

      this.uploadBucket = uploadBucket;

      new cdk.CfnOutput(this, 'UploadBucketName', {
        value: uploadBucket.bucketName,
        description: 'Upload/Data S3 Bucket Name',
        exportName: `${this.stackName}-UPLOAD-BUCKET-NAME`,
      });

      new cdk.CfnOutput(this, 'UploadBucketArn', {
        value: uploadBucket.bucketArn,
        description: 'Upload/Data S3 Bucket ARN',
        exportName: `${this.stackName}-UPLOAD-BUCKET-ARN`,
      });
    } else {
      if (!config.existingUploadBucketName) {
        throw new Error('existingUploadBucketName must be set when createUploadBucket is false');
      }

      this.uploadBucket = s3.Bucket.fromBucketName(
        this,
        'ExistingUploadBucket',
        config.existingUploadBucketName
      );

      new cdk.CfnOutput(this, 'UploadBucketName', {
        value: this.uploadBucket.bucketName,
        description: 'Upload/Data S3 Bucket Name (Imported)',
      });
    }
  }
}
