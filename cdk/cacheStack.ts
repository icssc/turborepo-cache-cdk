import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import {
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export default class CacheStack extends Stack {
  constructor(scope?: Construct, id?: string) {
    if (!process.env.TURBO_TOKEN)
      throw new Error("TURBO_TOKEN not provided. Stop.");
    super(scope, id);
    const bucket = new Bucket(this, "turborepo-cache-bucket", {
      autoDeleteObjects: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      bucketName: "turborepo-cache-bucket",
      lifecycleRules: [
        {
          enabled: true,
          id: "turborepo-cache-invalidate-rule",
          expiration: Duration.days(2 * 7),
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const { TURBO_TOKEN } = process.env;
    new RestApi(this, "turborepo-cache-api", {
      restApiName: "turborepo-cache-api",
    }).root.addMethod(
      "ANY",
      new LambdaIntegration(
        new Function(this, "turborepo-cache-lambda", {
          code: Code.fromAsset(
            join(dirname(fileURLToPath(import.meta.url)), "../dist")
          ),
          environment: {
            STORAGE_PATH: "turborepo-cache-bucket",
            STORAGE_PROVIDER: "s3",
            TURBO_TOKEN,
          },
          functionName: "turborepo-cache-lambda",
          handler: "index.handler",
          role: new Role(this, "turborepo-cache-lambda-role", {
            assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
              ManagedPolicy.fromAwsManagedPolicyName(
                "service-role/AWSLambdaBasicExecutionRole"
              ),
            ],
            inlinePolicies: {
              policy: new PolicyDocument({
                statements: [
                  new PolicyStatement({
                    effect: Effect.ALLOW,
                    actions: ["s3:*"],
                    resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
                  }),
                ],
              }),
            },
            roleName: "turborepo-cache-lambda-role",
          }),
          runtime: Runtime.NODEJS_16_X,
          timeout: Duration.seconds(10),
        })
      )
    );
  }
}