import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import type { S3Event } from "aws-lambda";

const client = new SQSClient({
  region: "",
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
});

const ecsClient = new ECSClient({
  region: "",
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
});

async function init() {
  const command = new ReceiveMessageCommand({
    QueueUrl: "",
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10,
  });

  while (true) {
    const { Messages } = await client.send(command);
    if (!Messages) {
      console.log(`No message in Queue`);
      continue;
    }

    try {
      for (const message of Messages) {
        const { MessageId, Body } = message;
        console.log(`Message Recieved`, { MessageId, Body });

        if (!Body) {
          continue;
        }

        // Validate and Parse the event
        const event = JSON.parse(Body) as S3Event;

        // Ignore the test event from S3
        if ("Service" in event && "Event" in event) {
          if (event.Event === "s3:TestEvent") {
            await client.send(
              new DeleteMessageCommand({
                QueueUrl: "",
                ReceiptHandle: message.ReceiptHandle,
              })
            );
            continue;
          }
        }

        // Spin the docker container
        for (const record of event.Records) {
          const { s3 } = record;
          const {
            bucket,
            object: { key },
          } = s3;

          const runTaskCommand = new RunTaskCommand({
            taskDefinition: "",
            cluster: "",
            launchType: "FARGATE",
            networkConfiguration: {
              awsvpcConfiguration: {
                assignPublicIp: "ENABLED",
                securityGroups: [""],
                subnets: ["", "", ""],
              },
            },
            overrides: {
              containerOverrides: [
                {
                  name: "video-transcoder",
                  environment: [
                    { name: "BUCKET_NAME", value: bucket.name },
                    { name: "KEY", value: key },
                  ],
                },
              ],
            },
          });

          await ecsClient.send(runTaskCommand);

          // Delete the message from Queue
          await client.send(
            new DeleteMessageCommand({
              QueueUrl: "",
              ReceiptHandle: message.ReceiptHandle,
            })
          );
        }
      }
    } catch (err) {
      console.log(err);
    }
  }
}

init();
