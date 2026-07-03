/**
 * Encodes a string as base64url (RFC 4648 §5).
 * Replaces `+` with `-`, `/` with `_`, and strips trailing `=`.
 * @param {string} str
 * @returns {string}
 */
export function toBase64Url(str) {
  const b64 = Buffer.from(str, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Parses an optional JSON action input.
 * @param {string} name
 * @param {string} value
 * @param {'array' | 'object'} expectedType
 * @returns {object | Array | undefined}
 */
export function parseJsonInput(name, value, expectedType) {
  if (!value || !value.trim()) {
    return undefined;
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid JSON for "${name}": ${error.message}`);
  }

  if (expectedType === 'array' && !Array.isArray(parsed)) {
    throw new Error(`Input "${name}" must be a JSON array.`);
  }

  if (expectedType === 'object' && !isPlainObject(parsed)) {
    throw new Error(`Input "${name}" must be a JSON object.`);
  }

  return parsed;
}

/**
 * Parses an optional boolean action input.
 * @param {string} value
 * @param {string} name
 * @returns {boolean | undefined}
 */
export function parseOptionalBoolean(value, name) {
  if (!value || !value.trim()) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(
    `Input "${name}" must be a boolean value such as "true" or "false".`
  );
}

function dedupePlugins(plugins, name = 'plugins') {
  return [
    ...new Set(
      plugins.map((plugin) => {
        if (typeof plugin !== 'string') {
          throw new Error(`Each entry in "${name}" must be a string.`);
        }

        return plugin.trim();
      }).filter(Boolean)
    ),
  ];
}

function mergeBlueprint(baseValue, overrideValue) {
  if (overrideValue === undefined) {
    return baseValue;
  }

  if (Array.isArray(overrideValue)) {
    return overrideValue;
  }

  if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
    const merged = { ...baseValue };

    for (const [key, value] of Object.entries(overrideValue)) {
      merged[key] = mergeBlueprint(baseValue[key], value);
    }

    return merged;
  }

  return overrideValue;
}

/**
 * Builds the blueprint JSON object from action inputs.
 * @param {string} zipUrl
 * @param {string} title
 * @param {string} author
 * @param {string} description
 * @param {object} [options]
 * @returns {object}
 */
export function buildBlueprint(
  zipUrl,
  title,
  author,
  description,
  options = {}
) {
  const {
    extraPlugins = [],
    seed,
    landingPage,
    debugEnabled,
    siteTitle,
    siteLocale,
    siteTimezone,
    loginUsername,
    loginPassword,
    blueprintOverride,
  } = options;

  const blueprint = {
    meta: {
      title,
      author,
      description,
    },
    plugins: dedupePlugins([zipUrl, ...extraPlugins], 'extra-plugins'),
  };

  if (landingPage) {
    blueprint.landingPage = landingPage;
  }

  if (debugEnabled !== undefined) {
    blueprint.debug = { enabled: debugEnabled };
  }

  const siteOptions = {};
  if (siteTitle) {
    siteOptions.title = siteTitle;
  }
  if (siteLocale) {
    siteOptions.locale = siteLocale;
  }
  if (siteTimezone) {
    siteOptions.timezone = siteTimezone;
  }
  if (Object.keys(siteOptions).length > 0) {
    blueprint.siteOptions = siteOptions;
  }

  const login = {};
  if (loginUsername) {
    login.username = loginUsername;
  }
  if (loginPassword) {
    login.password = loginPassword;
  }
  if (Object.keys(login).length > 0) {
    blueprint.login = login;
  }

  if (seed) {
    blueprint.seed = seed;
  }

  const mergedBlueprint = mergeBlueprint(blueprint, blueprintOverride);

  if (Array.isArray(mergedBlueprint.plugins)) {
    mergedBlueprint.plugins = dedupePlugins(
      mergedBlueprint.plugins,
      'blueprint-json.plugins'
    );
  }

  return mergedBlueprint;
}

/**
 * Constructs the full playground preview URL.
 * @param {string} playgroundUrl
 * @param {string} blueprintJson
 * @returns {string}
 */
export function buildPreviewUrl(playgroundUrl, blueprintJson) {
  const encoded = toBase64Url(blueprintJson);
  const base = playgroundUrl.endsWith('/')
    ? playgroundUrl
    : playgroundUrl + '/';
  return `${base}?blueprint-data=${encoded}`;
}

/**
 * Largest preview-URL length (in characters) considered safe. nginx caps the
 * request line at 8 KB by default (`large_client_header_buffers`), so a longer
 * URL risks an HTTP 414 rejection; we warn a little under that limit.
 * @type {number}
 */
export const MAX_SAFE_PREVIEW_URL = 8000;

/**
 * Returns `true` when the preview URL is long enough that a web server may
 * reject it with HTTP 414 (URI Too Long).
 * @param {string} url
 * @param {number} [max=MAX_SAFE_PREVIEW_URL]
 * @returns {boolean}
 */
export function previewUrlExceedsLimit(url, max = MAX_SAFE_PREVIEW_URL) {
  return typeof url === 'string' && url.length > max;
}

function buildPreviewBody(previewUrl, imageUrl, extraText) {
  let body = `## FacturaScripts Playground Preview

<a href="${previewUrl}">
  <img src="${imageUrl}" alt="Open this PR in FacturaScripts Playground" width="220">
</a><br>
<small><a href="${previewUrl}">Try this PR in your browser</a></small>

This preview was generated automatically from the PR branch ZIP.`;
  if (typeof extraText === 'string' && extraText.trim()) {
    body += `\n\n${extraText.trim()}`;
  }
  return body;
}

/**
 * Builds the body of the sticky PR comment.
 * @param {string} marker
 * @param {string} previewUrl
 * @param {string} imageUrl
 * @param {string} [extraText]
 * @returns {string}
 */
export function buildCommentBody(marker, previewUrl, imageUrl, extraText) {
  return `<!-- ${marker} -->\n${buildPreviewBody(previewUrl, imageUrl, extraText)}`;
}

/**
 * Builds the managed block inserted into the PR description in
 * `append-to-description` mode. The block is wrapped with `:start` and `:end`
 * marker comments so the action can find and update it on subsequent runs.
 * @param {string} marker
 * @param {string} previewUrl
 * @param {string} imageUrl
 * @param {string} [extraText]
 * @returns {string}
 */
export function buildDescriptionBlock(marker, previewUrl, imageUrl, extraText) {
  return `<!-- ${marker}:start -->\n${buildPreviewBody(previewUrl, imageUrl, extraText)}\n<!-- ${marker}:end -->`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns the regex that matches the managed description block (including a
 * trailing run of whitespace) for the given marker.
 * @param {string} marker
 * @returns {RegExp}
 */
export function descriptionBlockPattern(marker) {
  const escaped = escapeRegex(marker);
  return new RegExp(
    `<!-- ${escaped}:start -->([\\s\\S]*?)<!-- ${escaped}:end -->\\s*`,
    'm'
  );
}

/**
 * Computes the next PR body after applying (or skipping) the managed
 * description block. Returns `null` when the action should leave the body
 * untouched: either a user replaced the block content with their own placeholder
 * text, or the markers are missing and `restoreIfRemoved` is `false`.
 * @param {string} currentBody
 * @param {string} marker
 * @param {string} block
 * @param {object} [options]
 * @param {boolean} [options.restoreIfRemoved=true]
 * @returns {string | null}
 */
export function computeNextDescriptionBody(
  currentBody,
  marker,
  block,
  options = {}
) {
  const { restoreIfRemoved = true } = options;
  const body = currentBody || '';
  const pattern = descriptionBlockPattern(marker);
  const match = body.match(pattern);

  if (match) {
    const existingContent = (match[1] || '').trim();
    const looksLikeButton =
      existingContent.includes('<a ') &&
      existingContent.toLowerCase().includes('playground');
    if (existingContent && !looksLikeButton) {
      return null;
    }
    return body.replace(pattern, block);
  }

  if (!restoreIfRemoved) {
    return null;
  }

  const trimmed = body.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}` : block;
}

/**
 * Removes the managed description block from a PR body, if present. Returns
 * the original body when no markers are found.
 * @param {string} currentBody
 * @param {string} marker
 * @returns {string}
 */
export function removeDescriptionBlock(currentBody, marker) {
  const body = currentBody || '';
  const pattern = descriptionBlockPattern(marker);
  if (!pattern.test(body)) {
    return body;
  }
  return body.replace(pattern, '').trimEnd();
}
