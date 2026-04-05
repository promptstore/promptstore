import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface ElastiCacheStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

/**
 * ElastiCache Stack - Creates Redis cluster for promptstore caching
 *
 * Looks up the existing tapitriager VPC and EKS security group internally.
 *
 * NOTE: Standard ElastiCache Redis does NOT support the RediSearch module.
 * The VecSearch service (vector search) must run separately in EKS.
 * This ElastiCache instance handles only basic Redis caching.
 *
 * Resources created:
 * - ElastiCache Redis Replication Group
 * - ElastiCache Subnet Group (private subnets)
 * - Security Group (ingress from EKS on port 6379)
 * - Auth Token in Secrets Manager
 */
export class ElastiCacheStack extends cdk.Stack {
  public readonly redisEndpoint: string;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: ElastiCacheStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Look up the shared tapitriager VPC
    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
      vpcId: config.existingVpcId,
    });

    // Import EKS security group
    const eksSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this, 'ImportedEksSg', config.existingEksSgId,
      { mutable: false }
    );

    // Security group for ElastiCache
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      securityGroupName: `${config.appName}-redis-sg`,
      description: `Security group for ${config.appName} ElastiCache Redis`,
      allowAllOutbound: true,
    });

    cdk.Tags.of(this.redisSecurityGroup).add('Name', `${config.appName}-redis-sg`);

    // Allow EKS pods to connect to Redis
    this.redisSecurityGroup.addIngressRule(
      eksSecurityGroup,
      ec2.Port.tcp(6379),
      'Redis from EKS pods',
    );

    // ElastiCache Subnet Group (private subnets)
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      cacheSubnetGroupName: `${config.appName}-redis-subnet-group`,
      description: `Subnet group for ${config.appName} Redis`,
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
    });

    // Auth token stored in Secrets Manager
    const authTokenSecret = new secretsmanager.Secret(this, 'RedisAuthToken', {
      secretName: `${config.appName}-redis-auth-token`,
      description: `Auth token for ${config.appName} ElastiCache Redis`,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // Determine number of replicas (numCacheNodes - 1 for the primary)
    const numReplicas = Math.max(0, config.elasticacheNumCacheNodes - 1);

    // Redis Replication Group
    const replicationGroup = new elasticache.CfnReplicationGroup(this, 'RedisReplicationGroup', {
      replicationGroupDescription: `${config.appName} Redis cluster`,
      replicationGroupId: `${config.appName}-redis`,

      engine: 'redis',
      engineVersion: config.elasticacheEngineVersion,
      cacheNodeType: config.elasticacheNodeType,

      // Single shard, cluster mode disabled
      numCacheClusters: config.elasticacheNumCacheNodes,

      // Network
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName!,
      securityGroupIds: [this.redisSecurityGroup.securityGroupId],

      // Automatic failover (requires >= 2 nodes)
      automaticFailoverEnabled: numReplicas > 0,
      multiAzEnabled: numReplicas > 0,

      // Encryption
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      authToken: authTokenSecret.secretValue.unsafeUnwrap(),

      // Maintenance
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
      snapshotRetentionLimit: 1,
      snapshotWindow: '04:00-05:00',

      // Port
      port: 6379,
    });

    replicationGroup.addDependency(subnetGroup);

    this.redisEndpoint = replicationGroup.attrPrimaryEndPointAddress;

    // Outputs
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: replicationGroup.attrPrimaryEndPointAddress,
      description: 'Redis primary endpoint address',
      exportName: `${this.stackName}-REDIS-ENDPOINT`,
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: replicationGroup.attrPrimaryEndPointPort,
      description: 'Redis port',
      exportName: `${this.stackName}-REDIS-PORT`,
    });

    new cdk.CfnOutput(this, 'RedisAuthSecretArn', {
      value: authTokenSecret.secretArn,
      description: 'Redis auth token secret ARN',
      exportName: `${this.stackName}-REDIS-AUTH-SECRET-ARN`,
    });

    new cdk.CfnOutput(this, 'RedisSecurityGroupId', {
      value: this.redisSecurityGroup.securityGroupId,
      description: 'Redis security group ID',
      exportName: `${this.stackName}-REDIS-SG`,
    });
  }
}
