# uplite

**uplite** is a lightweight, self-hosted file upload, browsing, and management tool. It sets up a secure, password-protected web interface for uploading, listing, and managing files on your server. With basic authentication, configurable file size limits, and optional file type restrictions, **uplite** is perfect for simple, controlled file sharing within teams or secure environments.

## Features

- **Secure Uploading:** Protect your files with Basic Authentication.
- **Configurable Storage:** Specify the upload directory, maximum file size, and number of files per upload.
- **Optional File Extension Restrictions:** Limit uploads to certain file types.
- **File Browsing & Management:** Browse, download, and delete files through a clean web interface.
- **Detailed Info Page:** View file details such as size, modification date, and server info.
- **Search & Listing Page:** Access a built-in file index with search functionality at `/files`.

## Installation

To install **uplite** globally:

```bash
npm install -g uplite
```

Alternatively, clone or download this repository, then run:

```bash
npm install
npm link
```

## Usage

Once installed globally, simply run:

```bash
uplite
```

This starts the server with default settings. By default:

- Server runs on port `58080`
- Username: `admin`
- Password: `password`
- Upload directory: `./`
- Maximum files per upload: `10`
- Maximum file size: `5GB` (5 * 1024 * 1024 * 1024 bytes)
- Allowed file extensions: None (all allowed)

## Command-Line Options

You can customize uplite's behavior with command-line arguments:

```bash
uplite [options]
```

**Available Options:**

| Option              | Default              | Description                                                |
|---------------------|----------------------|------------------------------------------------------------|
| `--port <number>`   | `58080`              | The port the server listens on.                            |
| `--user <string>`   | `admin`             | Username for Basic Auth.                                   |
| `--password <string>` | `generated`         | Password for Basic Auth.                                   |
| `--dir <path>`      | `./`                | Directory to store uploaded files.                         |
| `--max-files <number>` | `10`              | Maximum number of files per upload request.                |
| `--max-size <bytes>` | `5368709120` (5GB) | Maximum allowed file size in bytes.                        |
| `--extensions <list>` | `""`              | Comma-separated list of allowed extensions (leave blank for all). |

**Example:**

```bash
uplite --port 3000 --user admin --password secret --dir /tmp/uploads --max-files 5 --max-size 10485760 --extensions jpg,png,gif
```

This command starts the server on port `3000`, sets a custom user and password, stores uploaded files in `/tmp/uploads`, limits uploads to 5 files at a time, restricts file size to ~10MB, and only allows `jpg`, `png`, and `gif` files.

## Accessing the Web Interface

After starting uplite, open your browser and navigate to:

```bash
http://localhost:<port>
```

You will be prompted for the username and password you specified (default: `admin` / `generated`).

**Main Interface:**
- Upload files by dragging & dropping or using the file picker.
- Browse recently uploaded files.
- Click "Info" for file details, or "Delete" to remove a file.
  
**File Listing & Search:**
- Visit:
```bash
http://localhost:<port>/files
```
Here you can search through and browse all uploaded files with directory index functionality.

## Security Considerations

- Always set a strong username and password before exposing uplite to the public internet.
- Consider running uplite behind a reverse proxy (e.g., Nginx) with HTTPS enabled.
- Set file extension restrictions and file size limits appropriate for your environment.

## Logging & Debugging

uplite logs requests (client IP, method, URL, status, and response time). If something goes wrong:
- Check the console output for errors.
- Use the `/files` endpoint to inspect what’s on the server.
- Adjust limits or restrictions via CLI options as needed.

## Development & Customization

If you wish to customize uplite:
- Clone the repository.
- Modify code and templates in the `views` and `public` directories.
- Run `npm start` locally for development.
- Contribute back improvements via pull requests.

## License

uplite is released under the [MIT License](LICENSE). You are free to use, modify, and distribute it as permitted by the license terms.

## Author
Lucian BLETAN