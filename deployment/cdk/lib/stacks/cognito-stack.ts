import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface CognitoStackProps extends cdk.StackProps {
  readonly config: EnvironmentConfig;
}

/**
 * Cognito Stack - Creates User Pool, App Client, Domain, and Groups
 *
 * Resources created:
 * - Cognito User Pool (email sign-in, standard attributes)
 * - App Client (authorization code flow, openid/email/profile scopes)
 * - User Pool Domain (hosted UI)
 * - User Groups (admin, manager, developer, analyst)
 */
export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const { config } = props;

    // =========================================================================
    // User Pool
    // =========================================================================

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${config.appName}-${config.cognitoDomainPrefix}`,

      // Sign-in configuration
      signInAliases: {
        email: true,
        username: true,
      },

      // Self-sign-up
      selfSignUpEnabled: config.cognitoSelfSignUpEnabled,

      // User verification via email
      userVerification: {
        emailSubject: `Verify your ${config.appName} account`,
        emailBody: 'Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },

      // Standard attributes
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
        phoneNumber: {
          required: false,
          mutable: true,
        },
        profilePicture: {
          required: false,
          mutable: true,
        },
      },

      // Password policy
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },

      // Account recovery
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // MFA
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },

      // Removal policy
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // =========================================================================
    // User Pool Domain (Hosted UI)
    // =========================================================================

    this.userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: config.cognitoDomainPrefix,
      },
    });

    // =========================================================================
    // App Client
    // =========================================================================

    this.userPoolClient = this.userPool.addClient('AppClient', {
      userPoolClientName: `${config.appName}-web`,

      // OAuth configuration
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: config.cognitoCallbackUrls,
        logoutUrls: config.cognitoLogoutUrls,
      },

      // Token validity
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      // Auth flows
      authFlows: {
        userSrp: true,
        userPassword: false,
      },

      // No client secret (public client for SPA)
      generateSecret: false,

      // Prevent user existence errors
      preventUserExistenceErrors: true,
    });

    // =========================================================================
    // User Groups (used for role-based access control)
    // =========================================================================

    const groups = ['admin', 'manager', 'developer', 'analyst'];

    for (const groupName of groups) {
      new cognito.CfnUserPoolGroup(this, `Group${groupName}`, {
        userPoolId: this.userPool.userPoolId,
        groupName: groupName,
        description: `${groupName.charAt(0).toUpperCase() + groupName.slice(1)} role`,
      });
    }

    // =========================================================================
    // Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-USER-POOL-ID`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${this.stackName}-USER-POOL-ARN`,
    });

    new cdk.CfnOutput(this, 'AppClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
      exportName: `${this.stackName}-APP-CLIENT-ID`,
    });

    const domainUrl = `https://${config.cognitoDomainPrefix}.auth.${config.region}.amazoncognito.com`;

    new cdk.CfnOutput(this, 'CognitoDomainUrl', {
      value: domainUrl,
      description: 'Cognito Hosted UI Domain URL',
      exportName: `${this.stackName}-DOMAIN-URL`,
    });

    new cdk.CfnOutput(this, 'AuthorityUrl', {
      value: `https://cognito-idp.${config.region}.amazonaws.com/${this.userPool.userPoolId}`,
      description: 'OIDC Authority URL',
      exportName: `${this.stackName}-AUTHORITY-URL`,
    });

    new cdk.CfnOutput(this, 'FrontendEnvVars', {
      value: [
        `REACT_APP_COGNITO_AUTHORITY=https://cognito-idp.${config.region}.amazonaws.com/${this.userPool.userPoolId}`,
        `REACT_APP_COGNITO_CLIENT_ID=${this.userPoolClient.userPoolClientId}`,
        `REACT_APP_COGNITO_DOMAIN=${domainUrl}`,
        `REACT_APP_COGNITO_SCOPE=openid email profile`,
        `REACT_APP_AWS_REGION=${config.region}`,
        `REACT_APP_COGNITO_USER_POOL_ID=${this.userPool.userPoolId}`,
      ].join('\n'),
      description: 'Frontend environment variables for Cognito integration',
    });

    new cdk.CfnOutput(this, 'BackendEnvVars', {
      value: [
        `AWS_COGNITO_REGION=${config.region}`,
        `AWS_COGNITO_USER_POOL_ID=${this.userPool.userPoolId}`,
        `AWS_COGNITO_CLIENT_ID=${this.userPoolClient.userPoolClientId}`,
      ].join('\n'),
      description: 'Backend environment variables for Cognito integration',
    });
  }
}
