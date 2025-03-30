const express = require("express");
const fsPromises = require("fs").promises; // For promise-based operations
const fs = require("fs"); // For streams
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const Docker = require("dockerode");
const archiver = require("archiver");
const { exec } = require("child_process");
const util = require("util");
const execAsync = util.promisify(exec);
const cors = require("cors");
const app = express();
const server = http.createServer(app);
const docker = new Docker();

// Middleware
app.use(express.json());
app.use(cors());

// Container management
app.post("/api/container/start", async (req, res) => {
  try {
    const containerId = `dev-${Date.now()}`;

    // Build the image
    console.log("Building container image...");
    await execAsync("docker build -t dev-app ./app");

    // Create and start container
    const container = await docker.createContainer({
      Image: "dev-app",
      name: containerId,
      ExposedPorts: {
        "3001/tcp": {},
      },
      Env: ["VITE_HOST=0.0.0.0", "VITE_PORT=3001"],
      HostConfig: {
        PortBindings: {
          "3001/tcp": [{ HostPort: "3001" }],
        },
      },
    });

    await container.start();

    res.json({
      success: true,
      containerId: containerId,
      port: 3001,
      status: "running",
    });
  } catch (error) {
    console.error("Error starting container:", error);
    res.status(500).json({
      error: "Failed to start container",
      details: error.message,
    });
  }
});

app.post("/api/container/finish", async (req, res) => {
  try {
    const { containerId } = req.body;

    if (!containerId) {
      return res.status(400).json({ error: "Container ID is required" });
    }

    // Create zip file
    const output = fsPromises.createWriteStream("./backup.zip");
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", async () => {
      try {
        // Stop and remove container
        const container = docker.getContainer(containerId);
        await container.stop();
        await container.remove();

        res.json({
          success: true,
          message: "Container stopped and backup created",
          backupPath: "./backup.zip",
        });
      } catch (error) {
        console.error("Error stopping container:", error);
        res.status(500).json({
          error: "Failed to stop container",
          details: error.message,
        });
      }
    });

    archive.on("error", (err) => {
      res.status(500).json({
        error: "Backup failed",
        details: err.message,
      });
    });

    archive.pipe(output);
    archive.directory("./app/", false);
    archive.finalize();
  } catch (error) {
    console.error("Error in finish operation:", error);
    res.status(500).json({
      error: "Operation failed",
      details: error.message,
    });
  }
});

app.post("/api/container/:containerId/edit", async (req, res) => {
  try {
    const { containerId } = req.params;
    const { filePath, content } = req.body;

    if (!filePath || !content) {
      return res
        .status(400)
        .json({ error: "filePath and content are required" });
    }

    const container = docker.getContainer(containerId);

    // Normalize the file path to ensure it starts with /app/
    const normalizedPath = filePath.startsWith("/app/")
      ? filePath
      : `/app/${filePath.startsWith("/") ? filePath.slice(1) : filePath}`;

    console.log("Writing to path:", normalizedPath);

    // Create directory and set permissions using root
    const dirPath = path.dirname(normalizedPath);
    const mkdirExec = await container.exec({
      Cmd: [
        "/bin/sh",
        "-c",
        `mkdir -p ${dirPath} && chown -R node:node ${dirPath}`,
      ],
      AttachStdout: true,
      AttachStderr: true,
      User: "root", // Use root to create directory and set permissions
    });
    await mkdirExec.start();

    // Write content to temporary file and move it to final location
    const tempFile = `/tmp/${path.basename(normalizedPath)}-${Date.now()}`;
    const writeCommand = `echo '${content.replace(
      /'/g,
      "'\\''"
    )}' > ${tempFile} && mv ${tempFile} ${normalizedPath}`;

    const exec = await container.exec({
      Cmd: ["/bin/sh", "-c", writeCommand],
      AttachStdout: true,
      AttachStderr: true,
      User: "node",
    });

    const stream = await exec.start();

    // Collect any error output
    let errorOutput = "";
    stream.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });

    await new Promise((resolve, reject) => {
      stream.on("end", resolve);
      stream.on("error", reject);
    });

    if (errorOutput) {
      console.error("Error output from write command:", errorOutput);
    }

    // Verify the file was written
    const verifyExec = await container.exec({
      Cmd: ["cat", normalizedPath],
      AttachStdout: true,
      AttachStderr: true,
      User: "node",
    });

    const verifyStream = await verifyExec.start();
    let verifyContent = "";

    verifyStream.on("data", (chunk) => {
      verifyContent += chunk.toString();
    });

    await new Promise((resolve) => {
      verifyStream.on("end", resolve);
    });

    if (!verifyContent) {
      throw new Error("File appears to be empty after writing");
    }

    res.json({
      success: true,
      message: "File updated in container",
      containerId,
      filePath: normalizedPath,
      contentLength: verifyContent.length,
    });
  } catch (error) {
    console.error("Error modifying file:", error);
    res.status(500).json({
      error: "Failed to modify file in container",
      details: error.message,
    });
  }
});

app.get("/api/container/:containerId/load-project", async (req, res) => {
  try {
    const { containerId } = req.params;
    const container = docker.getContainer(containerId);

    // Get list of files, excluding unwanted directories
    const exec = await container.exec({
      Cmd: [
        "/bin/sh",
        "-c",
        `cd /app && find . -type f \
        ! -path "*/node_modules/*" \
        ! -path "*/.git/*" \
        ! -path "*/dist/*" \
        ! -path "*/.cache/*"`,
      ],
      AttachStdout: true,
      AttachStderr: true,
      User: "node",
    });

    const stream = await exec.start();
    let fileList = "";

    await new Promise((resolve) => {
      stream.on("data", (chunk) => {
        fileList += chunk.toString();
      });
      stream.on("end", resolve);
    });

    // Process file list
    const files = fileList
      .split("\n")
      .filter((line) => line && line.trim())
      .map((file) => file.replace("./", ""));

    console.log(`Found ${files.length} files to process`);

    // Create a map to store file contents
    const projectFiles = {};

    // Process files in chunks
    const chunkSize = 10;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      console.log(
        `Processing chunk ${i / chunkSize + 1} of ${Math.ceil(
          files.length / chunkSize
        )}`
      );

      // Process files in parallel within each chunk
      await Promise.all(
        chunk.map(async (file) => {
          try {
            if (file.includes("inspection-handler")) {
              return;
            }
            // Use docker cp to copy file to host temporarily
            const tempDir = `/tmp/dev-container-${containerId}`;
            await execAsync(`mkdir -p ${tempDir}`);
            await execAsync(
              `docker cp ${containerId}:/app/${file} ${tempDir}/${path.basename(
                file
              )}`
            );

            // Read the file content
            const content = await fsPromises.readFile(
              `${tempDir}/${path.basename(file)}`,
              "utf8"
            );

            // Clean up temp file
            await execAsync(`rm ${tempDir}/${path.basename(file)}`);

            if (content.trim()) {
              projectFiles[file] = content;
              console.log(`Successfully loaded: ${file}`);
            }
          } catch (err) {
            console.error(`Error reading file ${file}:`, err);
          }
        })
      );

      // Add a small delay between chunks
      if (i + chunkSize < files.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Clean up temp directory
    await execAsync(`rm -rf /tmp/dev-container-${containerId}`);

    const fileCount = Object.keys(projectFiles).length;
    console.log(`Successfully loaded ${fileCount} files`);

    res.json({
      success: true,
      containerId,
      files: projectFiles,
      fileCount,
    });
  } catch (error) {
    console.error("Error loading project:", error);
    res.status(500).json({
      error: "Failed to load project from container",
      details: error.message,
    });
  }
});

app.get("/api/container/:containerId/load-paths", async (req, res) => {
  try {
    const { containerId } = req.params;
    const container = docker.getContainer(containerId);

    // Get list of files, excluding unwanted directories and focusing on text files
    const exec = await container.exec({
      Cmd: [
        "/bin/sh",
        "-c",
        `cd /app && find . -type f \
        ! -path "*/node_modules/*" \
        ! -path "*/.git/*" \
        ! -path "*/dist/*" \
        ! -path "*/.cache/*" \
        ! -name "*.png" \
        ! -name "*.jpg" \
        ! -name "*.jpeg" \
        ! -name "*.gif" \
        ! -name "*.ico" \
        ! -name "*.woff" \
        ! -name "*.woff2" \
        ! -name "*.ttf" \
        ! -name "*.eot" \
        ! -name "*.mp4" \
        ! -name "*.webm" \
        ! -name "*.mp3" \
        ! -name "*.wav" \
        ! -name "*.pdf" \
        -exec file {} \\; | grep text`,
      ],
      AttachStdout: true,
      AttachStderr: true,
      User: "node",
    });

    const stream = await exec.start();
    let fileList = "";

    await new Promise((resolve) => {
      stream.on("data", (chunk) => {
        fileList += chunk.toString();
      });
      stream.on("end", resolve);
    });

    // Process the file list to extract only the file paths
    const files = fileList
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        // Extract file path from the 'file' command output
        const match = line.match(/^\.\/(.+):/);
        return match ? match[1] : null;
      })
      .filter((file) => file !== null);

    res.json({
      success: true,
      containerId,
      files: files,
    });
  } catch (error) {
    console.error("Error loading paths:", error);
    res.status(500).json({
      error: "Failed to load paths from container",
      details: error.message,
    });
  }
});

app.post("/api/container/:containerId/file", async (req, res) => {
  try {
    const { containerId } = req.params;
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: "filePath is required" });
    }

    // Create a temporary directory and file
    const tempDir = `/tmp/dev-container-${containerId}-${Date.now()}`;
    const tempFile = `${tempDir}/${path.basename(filePath)}`;

    try {
      // Create temp directory
      await execAsync(`mkdir -p ${tempDir}`);

      // Copy file from container to host
      await execAsync(`docker cp ${containerId}:/app/${filePath} ${tempFile}`);

      // Read the file content
      const content = await fsPromises.readFile(tempFile, "utf8");

      // Clean up
      await execAsync(`rm -rf ${tempDir}`);

      res.json({
        success: true,
        content: content,
      });
    } catch (error) {
      // Clean up on error
      await execAsync(`rm -rf ${tempDir}`).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Error getting file:", error);
    res.status(500).json({
      error: "Failed to get file from container",
      details: error.message,
    });
  }
});

app.get("/api/container/:containerId/logs", async (req, res) => {
  try {
    const { containerId } = req.params;
    const { tail = 100, timestamps = true } = req.query; // Optional parameters

    const container = docker.getContainer(containerId);

    // Get container logs
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: parseInt(tail), // Number of lines to return from the end
      timestamps: timestamps === "true",
      follow: false,
    });

    // Convert buffer to string and split into lines
    const logLines = logs
      .toString("utf8")
      .split("\n")
      .filter((line) => line.trim())
      // Remove Docker log prefix (8 bytes) from each line if exists
      .map((line) => {
        if (line.length > 8) {
          return line.slice(8);
        }
        return line;
      });

    res.json({
      success: true,
      containerId,
      logs: logLines,
      count: logLines.length,
    });
  } catch (error) {
    console.error("Error getting container logs:", error);
    res.status(500).json({
      error: "Failed to get container logs",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 3939;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`File editing server running on port ${PORT}`);
  console.log(`
Example usage:

    # Start container:
    curl -X POST http://localhost:${PORT}/api/container/start

    # Edit file in container:
    curl -X POST http://localhost:${PORT}/api/container/[containerId]/edit \\
         -H "Content-Type: application/json" \\
         -d '{
           "filePath": "/app/src/pages/home.tsx",
           "content": "export function Home() { return <div>Updated Content</div>; }"
         }'

    # Get file from container:
    curl -X POST http://localhost:${PORT}/api/container/[containerId]/file \\
         -H "Content-Type: application/json" \\
         -d '{"filePath": "/app/src/pages/home.tsx"}'

    # Finish container and create backup:
    curl -X POST http://localhost:${PORT}/api/container/finish \\
         -H "Content-Type: application/json" \\
         -d '{"containerId": "[containerId]"}'

    # Load project from container:
    curl -X POST http://localhost:${PORT}/api/container/[containerId]/load-project

    # Load paths from container:
    curl -X POST http://localhost:${PORT}/api/container/[containerId]/load-paths

    # Get logs from container:
    curl -X GET http://localhost:${PORT}/api/container/[containerId]/logs?tail=100&timestamps=true

    # WebSocket connection:
    ws://localhost:${PORT}
    `);
});
