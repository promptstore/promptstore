import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface RdsStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

/**
 * RDS Stack - Creates PostgreSQL database for promptstore
 *
 * Looks up the existing tapitriager VPC and RDS security group internally,
 * then deploys a new RDS instance into the shared private subnets.
 *
 * Resources created:
 * - PostgreSQL 14 RDS instance
 * - DB Subnet Group (private subnets)
 * - Parameter Group with pg_stat_statements
 * - Secrets Manager secret for credentials
 */
export class RdsStack extends cdk.Stack {
  public readonly databaseInstance: rds.DatabaseInstance;
  public readonly databaseSecret: rds.DatabaseSecret;

  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Look up the shared tapitriager VPC
    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
      vpcId: config.existingVpcId,
    });

    // Import RDS security group as non-mutable to avoid cyclic dependencies
    const rdsSg = ec2.SecurityGroup.fromSecurityGroupId(
      this, 'ImportedRdsSg', config.existingRdsSgId,
      { mutable: false }
    );

    // Parse instance class from config string (e.g., "db.t3.medium")
    const instanceClassParts = config.rdsInstanceClass.split('.');
    const instanceClass = instanceClassParts[1] as keyof typeof ec2.InstanceClass;
    const instanceSize = instanceClassParts[2] as keyof typeof ec2.InstanceSize;

    // Create database credentials in Secrets Manager
    this.databaseSecret = new rds.DatabaseSecret(this, 'DatabaseSecret', {
      username: config.rdsUsername,
      secretName: `${config.appName}-rds-credentials`,
    });

    // Create parameter group for PostgreSQL
    const parameterGroup = new rds.ParameterGroup(this, 'ParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14,
      }),
      description: `Parameter group for ${config.appName} PostgreSQL 14`,
      parameters: {
        shared_preload_libraries: 'pg_stat_statements',
        log_statement: 'all',
        log_min_duration_statement: '1000',
      },
    });

    // Create RDS instance
    this.databaseInstance = new rds.DatabaseInstance(this, 'DatabaseInstance', {
      instanceIdentifier: `${config.appName}-postgres-db`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass[instanceClass.toUpperCase() as keyof typeof ec2.InstanceClass],
        ec2.InstanceSize[instanceSize.toUpperCase() as keyof typeof ec2.InstanceSize]
      ),
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      databaseName: config.rdsDatabaseName,

      // Network - uses tapitriager's VPC private subnets
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [rdsSg],
      publiclyAccessible: false,

      // Storage
      allocatedStorage: config.rdsAllocatedStorage,
      maxAllocatedStorage: config.rdsMaxAllocatedStorage,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,

      // Backup
      backupRetention: cdk.Duration.days(7),
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',

      parameterGroup: parameterGroup,

      // Monitoring
      monitoringInterval: cdk.Duration.seconds(60),
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT,
      cloudwatchLogsRetention: logs.RetentionDays.ONE_WEEK,

      // Deletion Protection
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    cdk.Tags.of(this.databaseInstance).add('Name', `${config.appName} PostgreSQL Database`);

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.databaseInstance.dbInstanceEndpointAddress,
      description: 'RDS instance endpoint',
      exportName: `${this.stackName}-DB-ENDPOINT`,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.databaseInstance.dbInstanceEndpointPort,
      description: 'RDS instance port',
      exportName: `${this.stackName}-DB-PORT`,
    });

    new cdk.CfnOutput(this, 'DatabaseName', {
      value: config.rdsDatabaseName,
      description: 'Database name',
      exportName: `${this.stackName}-DB-NAME`,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'Secrets Manager secret ARN',
      exportName: `${this.stackName}-SECRET-ARN`,
    });
  }
}
