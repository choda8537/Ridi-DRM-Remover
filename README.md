# Ridi-DRM-Remover

A CLI tool to decrypt purchased and downloaded ebooks from Ridibooks, converting them into DRM-free files (EPUB/PDF).

> **Disclaimer**
>
> All goods obtained through this software must not be shared, distributed, or sold. Any consequences resulting from the misuse of this software are solely the user's responsibility. Use at your own risk.

## Prerequisites

- [**Bun**](https://bun.sh/) (latest version)
- **Ridibooks Desktop App**: Books must be downloaded through the official app before they can be decrypted.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/thecats1105/Ridi-DRM-Remover.git
   cd Ridi-DRM-Remover
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

## Usage

The tool can be run using `bun run dev`.

```bash
bun run dev --help
```

### 1. Authentication (`auth`)

Before decrypting, you need to authenticate to store your `device_id` and `user_idx`.

```bash
bun run dev auth login
```

- Follow the instructions to log in through the browser.
- Once logged in, copy the JSON data from the provided page.
- Paste it back into the terminal and select the device where your books are downloaded.

**Other auth commands:**

- `bun run dev auth list`: List saved accounts.
- `bun run dev auth switch`: Switch the active account.
- `bun run dev auth logout`: Remove account information.

### 2. List Books (`books`)

Scan your local library to see which books are available for decryption.

```bash
bun run dev books
```

- **Filter by name**: `bun run dev books -n "Aranya"`
- **Filter by ID**: `bun run dev books -i "123456"`

### 3. Decrypt and Export (`export`)

Decrypt the downloaded books and save them to a specified directory.

```bash
# Export all downloaded books
bun run dev export --all -o ./output

# Export specific book by ID
bun run dev export -i "123456" -o ./output

# Export books matching a name
bun run dev export -n "Title"
```

## Compilation (Build)

You can compile the tool into a standalone executable using Bun:

```bash
bun run build
```

After building, the single executable will be located in the `dist/` directory.

## Features

- **Multi-account support**: Manage multiple Ridi accounts. Device selection ensures the decryption data matches the specific device where the Ridi viewer is running.
- **Title Extraction**: Automatically extracts book titles from EPUB/PDF metadata for clean filenames.
- **EPUB & PDF Support**: Handles both major ebook formats provided by Ridibooks.
- **Safe Filenames**: Sanitizes titles to prevent filesystem errors.

## References

- [Retro-Rex8/Ridi-DRM-Remover](https://github.com/Retro-Rex8/Ridi-DRM-Remover)
- [hsj1/ridiculous](https://github.com/hsj1/ridiculous)
