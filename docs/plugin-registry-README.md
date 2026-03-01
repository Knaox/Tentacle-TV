# Tentacle TV Plugin Registry

This repository hosts the official plugin registry for Tentacle TV.

## Registry Format

The registry is a single `registry.json` file with the following structure:

```json
{
  "name": "Registry Name",
  "description": "Registry description",
  "author": "Author name",
  "url": "https://github.com/your-org/your-registry",
  "plugins": [...]
}
```

### Plugin Entry

Each plugin in the `plugins` array has the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique plugin identifier (e.g. `"seer"`) |
| `name` | string | Yes | Human-readable plugin name |
| `description` | string | Yes | Short description |
| `author` | string | Yes | Plugin author |
| `repo` | string | No | GitHub repository (e.g. `"user/repo"`) |
| `icon` | string | No | URL to the plugin icon |
| `latestVersion` | string | Yes | Current latest version (semver) |
| `versions` | array | Yes | Array of version entries (newest first) |
| `tags` | string[] | No | Searchable tags |
| `platforms` | string[] | No | Supported platforms: `"web"`, `"desktop"`, `"mobile"` |
| `category` | string | No | Plugin category (e.g. `"media-management"`) |

### Version Entry

Each version in the `versions` array:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Semver version string |
| `minTentacleVersion` | string | Yes | Minimum compatible Tentacle TV version |
| `maxTentacleVersion` | string | No | Maximum compatible version (`null` = no limit) |
| `downloadUrl` | string | Yes | URL to the `.tar.gz` archive |
| `checksum` | string | Yes | SHA256 checksum (`"sha256:hexdigest"`) |
| `changelog` | string | No | Changelog text or URL |
| `releaseDate` | string | Yes | ISO date string (YYYY-MM-DD) |

## Adding a Plugin

1. Fork this repository
2. Add your plugin entry to `registry.json`
3. Ensure your plugin archive is hosted at the `downloadUrl`
4. Calculate the SHA256 checksum: `sha256sum your-plugin.tar.gz`
5. Submit a pull request

## Hosting Your Own Registry

You can host a custom plugin registry by:

1. Creating a JSON file following the format above
2. Hosting it at a public HTTPS URL
3. Adding it as a source in Tentacle TV admin > Plugins > Sources

The URL can point to a GitHub raw file, a CDN, or any HTTPS endpoint that returns valid JSON.

## Building a Plugin Archive

Plugin archives are `.tar.gz` files containing the compiled plugin:

```bash
cd packages/plugin-your-plugin
pnpm tsc
tar -czf plugin-name-v1.0.0.tar.gz --exclude=node_modules --exclude=.turbo -C .. plugin-your-plugin
```

The `build-web.ps1` script automates this process for plugins in the monorepo.
