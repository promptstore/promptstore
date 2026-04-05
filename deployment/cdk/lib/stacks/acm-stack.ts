import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface AcmStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

/**
 * ACM Stack - Creates TLS certificate for the ALB ingress
 *
 * The certificate requires DNS validation. After deployment:
 * 1. Check the stack output for the CNAME validation record
 * 2. Add the CNAME to your DNS provider
 * 3. Wait for validation (usually a few minutes)
 *
 * Once validated, the certificate ARN is used by the Helm ingress
 * via the ACM_CERTIFICATE_ARN GitHub environment secret.
 */
export class AcmStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: AcmStackProps) {
    super(scope, id, props);

    const { config } = props;

    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: config.acmDomainName,
      subjectAlternativeNames: config.acmSubjectAlternativeNames,
      validation: acm.CertificateValidation.fromDns(),
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'ACM Certificate ARN (use as ACM_CERTIFICATE_ARN GitHub secret)',
      exportName: `${this.stackName}-CERTIFICATE-ARN`,
    });
  }
}
