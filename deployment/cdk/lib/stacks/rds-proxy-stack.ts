import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface RdsProxyStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
  readonly databaseInstance: rds.IDatabaseInstance;
  readonly databaseSecret: secretsmanager.ISecret;
}

/**
 * RDS Proxy Stack - Connection pooling for promptstore database
 *
 * Looks up the shared VPC and security groups internally.
 *
 * Sits between EKS pods and the RDS instance, providing:
 * - Connection pooling and multiplexing
 * - Improved failover handling
 * - Secrets Manager authentication
 *
 * Uses L1 constructs (CfnDBProxy) to avoid cyclic cross-stack dependencies.
 */
export class RdsProxyStack extends cdk.Stack {
  public readonly proxyEndpoint: string;
  public readonly proxySecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: RdsProxyStackProps) {
    super(scope, id, props);

    const { config, databaseInstance, databaseSecret } = props;

    // Look up shared infrastructure
    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
      vpcId: config.existingVpcId,
    });

    const eksSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this, 'ImportedEksSg', config.existingEksSgId,
      { mutable: false }
    );

    const rdsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this, 'ImportedRdsSg', config.existingRdsSgId,
      { mutable: false }
    );

    // Security group for RDS Proxy
    this.proxySecurityGroup = new ec2.SecurityGroup(this, 'RdsProxySecurityGroup', {
      vpc,
      securityGroupName: `${config.appName}-rds-proxy-sg`,
      description: `Security group for ${config.appName} RDS Proxy`,
      allowAllOutbound: true,
    });

    cdk.Tags.of(this.proxySecurityGroup).add('Name', `${config.appName}-rds-proxy-sg`);

    // Allow EKS pods to connect to the proxy
    this.proxySecurityGroup.addIngressRule(
      eksSecurityGroup,
      ec2.Port.tcp(5432),
      'PostgreSQL from EKS pods',
    );

    // Allow proxy to connect to RDS
    new ec2.CfnSecurityGroupIngress(this, 'RdsIngressFromProxy', {
      groupId: rdsSecurityGroup.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: this.proxySecurityGroup.securityGroupId,
      description: `PostgreSQL from ${config.appName} RDS Proxy`,
    });

    // IAM role for RDS Proxy to read credentials from Secrets Manager
    const proxyRole = new iam.Role(this, 'RdsProxyRole', {
      roleName: `${config.appName}-rds-proxy-role`,
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
      description: `IAM role for ${config.appName} RDS Proxy to access Secrets Manager`,
    });

    proxyRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: [databaseSecret.secretArn],
    }));

    // RDS Proxy (L1 construct)
    const proxyName = `${config.appName}-rds-proxy`;

    const proxy = new rds.CfnDBProxy(this, 'RdsProxy', {
      dbProxyName: proxyName,
      engineFamily: 'POSTGRESQL',
      auth: [{
        authScheme: 'SECRETS',
        iamAuth: 'DISABLED',
        secretArn: databaseSecret.secretArn,
      }],
      roleArn: proxyRole.roleArn,
      vpcSecurityGroupIds: [this.proxySecurityGroup.securityGroupId],
      vpcSubnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
      requireTls: false,
      idleClientTimeout: 1800,
      debugLogging: false,
    });

    // Default target group
    const targetGroup = new rds.CfnDBProxyTargetGroup(this, 'RdsProxyTargetGroup', {
      dbProxyName: proxyName,
      targetGroupName: 'default',
      dbInstanceIdentifiers: [databaseInstance.instanceIdentifier],
      connectionPoolConfigurationInfo: {
        maxConnectionsPercent: 100,
        maxIdleConnectionsPercent: 50,
        connectionBorrowTimeout: 120,
      },
    });

    targetGroup.addDependency(proxy);

    this.proxyEndpoint = proxy.attrEndpoint;

    // Outputs
    new cdk.CfnOutput(this, 'ProxyEndpoint', {
      value: proxy.attrEndpoint,
      description: 'RDS Proxy endpoint (use as PGHOST)',
      exportName: `${this.stackName}-PROXY-ENDPOINT`,
    });

    new cdk.CfnOutput(this, 'ProxySecurityGroupId', {
      value: this.proxySecurityGroup.securityGroupId,
      description: 'RDS Proxy security group ID',
      exportName: `${this.stackName}-PROXY-SG`,
    });
  }
}
