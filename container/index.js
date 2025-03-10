const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("node:fs/promises");
const path = require("node:path");
const fsOld = require("node:fs");
const ffmpeg = require("fluent-ffmpeg");

const RESOLUTIONS = [
  { name: "360p", width: 480, height: 360 },
  { name: "480p", width: 850, height: 480 },
  { name: "720p", width: 1280, height: 720 },
];

const s3Client = new S3Client({
  region: "",
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const KEY = process.env.KEY;

async function init() {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: KEY,
  });

  const result = await s3Client.send(command);
  const originalFilePath = `original-video.mp4`;

  await fs.writeFile(originalFilePath, result.Body);

  const originalVideoPath = path.resolve(originalFilePath);

  // Start the transcoder
  const promises = RESOLUTIONS.map((resolution) => {
    const output = `video-${resolution.name}.mp4`;

    return new Promise((resolve) => {
      ffmpeg(originalVideoPath)
        .output(output)
        .withVideoCodec("libx264")
        .withAudioCodec("aac")
        .withSize(`${resolution.width}x${resolution.height}`)
        .on("start", () =>
          console.log("Start", `${resolution.width}x${resolution.height}`)
        )
        .on("end", async () => {
          const putCommand = new PutObjectCommand({
            Bucket: "",
            Key: output,
            Body: fsOld.createReadStream(path.resolve(output)),
          });
          await s3Client.send(putCommand);
          console.log(`Uploaded ${output}`);
          resolve();
        })
        .format("mp4")
        .run();
    });
  });

  await Promise.all(promises);
}

init();
