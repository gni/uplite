#!/usr/bin/env node

const express = require("express");
const multer = require("multer");
const basicAuth = require("basic-auth");
const path = require("path");
const fs = require("fs-extra");
const serveIndex = require("serve-index");
const minimist = require("minimist");
const os = require("os");
const morgan = require("morgan");

// Parse CLI arguments with defaults
const args = minimist(process.argv.slice(2), {
    default: {
        port: 58080,
        user: "admin",
        password: "password",
        dir: "./",
        "max-files": 10,
        "max-size": 5 * 1024 * 1024 * 1024,
        extensions: "",
    },
});

const port = args.port;
const username = args.user;
let password = args.password;
const uploadDir = path.resolve(args.dir);
const maxFiles = args["max-files"];
const maxSize = parseInt(args["max-size"], 10);
const allowedExtensions = args.extensions
    ? args.extensions.split(",").map((ext) => ext.trim().toLowerCase())
    : [];

// If user did not change the default password, generate a simple random one
if (password === "password") {
    password = generateSimpleRandomPassword(8);
}

// Ensure upload directory exists
fs.ensureDirSync(uploadDir);

// Simple random password generator
function generateSimpleRandomPassword(length) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Authentication middleware
function auth(req, res, next) {
    const credentials = basicAuth(req);
    if (!credentials || credentials.name !== username || credentials.pass !== password) {
        res.set("WWW-Authenticate", 'Basic realm="uplite"');
        return res.status(401).send("Access Denied");
    }
    next();
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const cleanFileName = file.originalname
            .replace(/[^a-zA-Z0-9_\-.]/g, "_") // Sanitize file names
            .replace(/\s+/g, "_");
        cb(null, `${timestamp}-${cleanFileName}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
        console.log("Processing file:", file.originalname);

        if (allowedExtensions.length === 0) {
            console.log("File accepted (no restrictions).");
            return cb(null, true);
        }

        const fileExtension = path.extname(file.originalname).toLowerCase().replace(".", "");
        if (allowedExtensions.includes(fileExtension)) {
            console.log("File accepted:", file.originalname);
            cb(null, true);
        } else {
            console.error("File rejected due to invalid extension:", file.originalname);
            cb(new Error(`Invalid file type. Allowed extensions are: ${allowedExtensions.join(", ")}`));
        }
    },
});

// Initialize Express app
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use("/static", express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set headers to improve security
app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.removeHeader("X-Powered-By");
    next();
});

// Enhanced logging middleware
app.use(
    morgan((tokens, req, res) => {
        const clientIP = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
        const ipv4 = clientIP.includes("::ffff:") ? clientIP.split(":").pop() : clientIP;

        return [
            ipv4,                                 // Client's IPv4 address
            tokens.method(req, res),              // HTTP method
            tokens.url(req, res),                 // Requested URL
            tokens.status(req, res),              // Response status
            tokens["response-time"](req, res),    // Response time
            "ms",                                 // Time unit
        ].join(" ");
    })
);

// Routes
app.get("/", auth, async (req, res) => {
    try {
        const files = await fs.readdir(uploadDir);
        const fileDetails = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(uploadDir, file);
                if (!(await fs.pathExists(filePath))) {
                    return null;
                }
                const stats = await fs.stat(filePath);
                return {
                    name: file,
                    time: stats.mtimeMs,
                };
            })
        );

        const sortedFiles = fileDetails
            .filter(Boolean)
            .sort((a, b) => b.time - a.time)
            .map((file) => file.name);

        res.render("index", { files: sortedFiles });
    } catch (err) {
        console.error("Error reading files:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/upload", auth, upload.array("file", maxFiles), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).send("No files were uploaded.");
        }
        console.log("Uploaded files:", req.files.map((f) => f.originalname));
        res.redirect("/");
    } catch (err) {
        console.error("Upload error:", err.message);
        res.status(500).send(err.message || "An error occurred during upload.");
    }
});

app.get("/info/:filename", auth, async (req, res) => {
    const fileName = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, fileName);
    try {
        if (!(await fs.pathExists(filePath))) {
            return res.status(404).send("File not found.");
        }

        const stats = await fs.stat(filePath);
        const fileInfo = {
            name: fileName,
            size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            modified: stats.mtime.toLocaleString(),
            absolutePath: filePath,
            os: os.type(),
            arch: os.arch(),
            host: os.hostname(),
            userIP: req.ip || req.headers["x-forwarded-for"],
        };
        res.render("info", { fileInfo });
    } catch (err) {
        console.error("Error getting file info:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.get("/delete/:filename", auth, async (req, res) => {
    const fileName = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, fileName);
    try {
        if (!(await fs.pathExists(filePath))) {
            console.warn(`Attempted to access deletion page for non-existent file: ${fileName}`);
            return res.status(404).send("File not found.");
        }
        res.render("confirm-delete", { fileName });
    } catch (err) {
        console.error("Error checking file existence for deletion:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.post("/delete/:filename", auth, async (req, res) => {
    const fileName = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, fileName);

    try {
        if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            console.log(`Deleted file: ${fileName}`);
        } else {
            console.warn(`Attempted to delete non-existent file: ${fileName}`);
        }
        res.redirect("/");
    } catch (err) {
        console.error("Error deleting file:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.use("/files", auth, express.static(uploadDir), serveIndex(uploadDir, { icons: true }));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.message);
    res.status(500).send(err.message || "An unexpected error occurred.");
});

// Start the server on all interfaces
app.listen(port, () => {
    const networkInterfaces = os.networkInterfaces();
    const uniqueAddresses = new Set();

    console.log("\n=== uplite server is running ===\n");

    // Add localhost explicitly
    uniqueAddresses.add(`http://localhost:${port}`);
    uniqueAddresses.add(`http://127.0.0.1:${port}`);

    // Add network interfaces
    Object.values(networkInterfaces).forEach((interfaces) => {
        interfaces.forEach((iface) => {
            if (iface.family === "IPv4") {
                uniqueAddresses.add(`http://${iface.address}:${port}`);
            }
        });
    });

    console.log("Access the server at the following addresses:\n");
    uniqueAddresses.forEach((address) => console.log(` - ${address}`));

    console.log("\nServer Configuration:");
    console.log(` - Shared Folder     : ${uploadDir}`);
    console.log(` - Username          : ${username}`);
    console.log(` - Password          : ${password}`);
    console.log(` - Allowed Extensions: ${allowedExtensions.length > 0 ? allowedExtensions.join(", ") : "All"}`);
    console.log(` - Max Files/Upload  : ${maxFiles}`);
    console.log(` - Max File Size     : ${(maxSize / (1024 * 1024)).toFixed(2)} MB\n`);
    console.log("=================================\n");
});
