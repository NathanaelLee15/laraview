const express = require('express');
const glob = require('glob');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Middleware for parsing JSON and urlencoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Basic route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let apiToken = null;

async function getApiToken() {
    if (!apiToken) {
        try {
            console.log('Attempting to get API token...');
            const response = await axios.post('http://localhost:8000/api/token', {
                email: process.env.LARAVEL_AUTH_EMAIL || 'test@example.com',
                password: process.env.LARAVEL_AUTH_PASSWORD || 'password'
            }, {
                validateStatus: null // Allow any status code for better error handling
            });

            if (response.status !== 200) {
                console.error('API token request failed:', {
                    status: response.status,
                    data: response.data,
                    headers: response.headers
                });
                throw new Error(`Request failed with status code ${response.status}`);
            }

            apiToken = response.data.token;
            console.log('Successfully obtained API token');
        } catch (error) {
            if (error.response?.status === 404) {
                console.error('API route not found. Make sure Laravel is running and routes are registered properly.');
            }
            console.error('Failed to get API token:', {
                message: error.message,
                response: error.response?.data,
                config: {
                    url: error.config?.url,
                    method: error.config?.method,
                    data: error.config?.data
                }
            });
            throw error;
        }
    }
    return apiToken;
}

app.get('/explore/:file_name', async (req, res) => {
    const file_name = req.params.file_name.replaceAll('__', '/');
    if (file_name.includes('resources/views')) {
        const file = file_name.split('/').pop();
        console.log(file);
        const target = file.replace('.blade', '').replace('.php', '');

        const token = await getApiToken();
        if (!token) {
            res.status(401).send('Failed to authenticate with Laravel server');
            return;
        }

        try {
            const result = await axios.get(`http://localhost:8000/api/views/${target}`, {
                headers: {
                    'Accept': 'text/html',
                    'Authorization': `Bearer ${token}`
                }
            });
            res.setHeader('Content-Type', 'text/html');
            let file_content = result.data.replace('</head>', '<script>document.addEventListener("DOMContentLoaded", function() {document.body.insertAdjacentHTML("beforebegin", "<div style=\'background-color:rgb(122, 204, 231); color: white; padding: 10px;\'><a href=\'http://localhost:3000\'>Back to explorer</a></div>");});</script></head>');
            res.send(file_content);
        } catch (error) {
            console.error('Error fetching view:', error.message);
            if (error.response?.status === 401) {
                // Token might be expired, clear it and try again
                apiToken = null;
                res.status(401).send('Authentication failed - please try again');
            } else {
                res.status(error.response?.status || 500).send('Error fetching view');
            }
        }
        return;
    }

    const file_path = path.join(process.cwd(), 'example-app', file_name);
    let file_content = fs.readFileSync(file_path, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    let head = '<head>'
    head += '<script>document.addEventListener("DOMContentLoaded", function() {document.body.insertAdjacentHTML("beforebegin", "<div style=\'display:flex; gap:10px; justify-content:space-between; background-color:rgb(122, 204, 231); color: white; padding: 10px;\'><div><a href=\'http://localhost:3000\' style=\'flex:2;width:max-content;\'>Back to explorer</a></div><div><a href=\'cursor://file/'+file_path.replaceAll('\\', '/').replace('C:', 'c:')+'\' style=\'flex:2; text-align:center; width:max-content;\'>Open ' + file_path.replaceAll('\\', '/') + '</a></div></div>");});</script>';

    head += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/default.min.css">';
    head += '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/atom-one-dark.min.css">';
    head += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>';
    head += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/php.min.js"></script>';
    head += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/html.min.js"></script>';
    head += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/javascript.min.js"></script>';
    head += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/css.min.js"></script>';
    head += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/json.min.js"></script>';
    head += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/xml.min.js"></script>';
    head += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/sql.min.js"></script>';
    head += '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/python.min.js"></script>';
    head += '</head>';
    let ext = 'html';
    if (file_name.endsWith('blade.php')) {
        ext = 'html';
    } else if (file_name.endsWith('php')) {
        ext = 'php';
    } else if (file_name.endsWith('js')) {
        ext = 'javascript';
    } else if (file_name.endsWith('css')) {
        ext = 'css';
    } else if (file_name.endsWith('json')) {
        ext = 'json';
    } else if (file_name.endsWith('sql')) {
        ext = 'sql';
    } else if (file_name.endsWith('py')) {
        ext = 'python';
    } else if (file_name.endsWith('java')) {
        ext = 'java';
    }
    let body = '<body style="background-color:rgb(57, 70, 90);">'; //282c34
    body += '<div style="margin: auto; width: 90%;">';
    body += '<pre class="theme-atom-one-dark tab-size"><span class="hljs"><code class="language-' + ext + '" style="border-radius: 10px;">';
    let content = file_content;
    if (ext === 'php') {
        content = content.replace('<?php', '&lt;?php').replace('?>;', '?&gt;');
    }
    body += content;
    body += '</code></span></pre>';
    body += '<script>hljs.highlightAll();</script>';
    body += '</div>';
    body += '</body>';
    file_content = '<!DOCTYPE html><html>' + head + body + '</html>';
    res.send(file_content);
});

function readFilesFromPattern(pattern, baseDir) {
    try {
        // Handle absolute paths and normalize slashes for Windows
        const normalizedPattern = path.join(baseDir, pattern).replace(/\\/g, '/');

        // If pattern ends with *, make it **/* to get everything recursively
        const recursivePattern = normalizedPattern.endsWith('*') ?
            normalizedPattern.replace(/\*$/, '**/*') :
            normalizedPattern;

        console.log('Searching pattern:', recursivePattern); // Debug log

        // Get both files and directories, including symlinks
        const items = glob.sync(recursivePattern, {
            dot: false, // Ignore dot files
            absolute: true, // Get absolute paths initially
            mark: true, // Add / to directories
            follow: true // Follow symlinks
        });

        console.log('Found items:', items); // Debug log

        return items.map(item => {
            // Convert absolute paths to relative paths from baseDir
            const relativePath = path.relative(baseDir, item);
            const normalizedPath = relativePath.replace(/\\/g, '/');

            // Get file stats with symlink info
            const stats = fs.lstatSync(item);
            const isSymlink = stats.isSymbolicLink();
            const realPath = isSymlink ? fs.realpathSync(item) : item;
            const realStats = fs.statSync(realPath);

            // If it's a directory (ends with / or is a directory symlink)
            if (item.endsWith('/') || item.endsWith('\\') || realStats.isDirectory()) {
                const dirContents = fs.readdirSync(realPath).map(child =>
                    path.join(relativePath, child).replace(/\\/g, '/')
                );
                return {
                    path: normalizedPath,
                    type: 'directory',
                    isSymlink: isSymlink,
                    target: isSymlink ? path.relative(baseDir, realPath).replace(/\\/g, '/') : undefined,
                    contents: dirContents
                };
            }

            // Return file info
            return {
                path: normalizedPath,
                type: 'file',
                isSymlink: isSymlink,
                target: isSymlink ? path.relative(baseDir, realPath).replace(/\\/g, '/') : undefined
            };
        });
    } catch (error) {
        console.error(`Error reading pattern ${pattern}:`, error);
        return [];
    }
}

function readConfigPatterns(configKey = 'targets') {
    try {
        const configPath = path.join(process.cwd(), 'view-config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // Get the base directory from config
        const baseDir = path.join(process.cwd(), config.app_path || '');
        console.log('Base directory:', baseDir); // Debug log

        const result = {};

        // Process each pattern in the config
        for (const [key, pattern] of Object.entries(config[configKey])) {
            if (key.startsWith('!')) {
                console.log(`Skipping ${key}:`, pattern); // Debug log
                continue;
            }
            console.log(`Processing ${key}:`, pattern); // Debug log

            // Handle single file case
            if (!pattern.includes('*')) {
                const filePath = path.join(baseDir, pattern);
                if (fs.existsSync(filePath)) {
                    const stats = fs.statSync(filePath);
                    result[key] = [{
                        path: pattern,
                        type: stats.isDirectory() ? 'directory' : 'file',
                        ...(stats.isDirectory() && {
                            contents: fs.readdirSync(filePath).map(child =>
                                path.join(pattern, child).replace(/\\/g, '/')
                            )
                        })
                    }];
                } else {
                    console.log(`File not found: ${filePath}`); // Debug log
                    result[key] = [];
                }
            } else {
                // Handle pattern matching case
                result[key] = readFilesFromPattern(pattern, baseDir);
            }
        }

        return result;
    } catch (error) {
        console.error('Error reading config:', error);
        return {};
    }
}

function transformFileStructure(fileStructure) {
    const result = { app: {} };

    // Helper function to get the base name of a file/directory
    const getBaseName = (path) => path.split('/').pop();

    // Helper function to capitalize first letter
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    for (const [key, items] of Object.entries(fileStructure)) {
        // Skip empty arrays
        if (!items || !items.length) continue;

        // Determine the section name (Models, Views, Controllers)
        const sectionName = capitalize(key);
        result.app[sectionName] = {};

        // Process each file in the section
        items.forEach(item => {
            if (item.type === 'file') {
                const fileName = getBaseName(item.path);
                result.app[sectionName][fileName] = item.path;
            }
        });
    }

    return result;
}

app.get('/api/get-project-data', (req, res) => {
    const fileStructure = readConfigPatterns('targets');
    const fileStructureSingles = readConfigPatterns('singles');
    const transformedStructure = transformFileStructure(fileStructure);
    const transformedSingles = transformFileStructure(fileStructureSingles);

    let resData = {};
    for (let section in transformedStructure['app']) {
        resData[section] = transformedStructure['app'][section];
    }
    let singles = {}
    for (let single in transformedSingles['app']) {
        for (let item in transformedSingles['app'][single]) {
            singles[item] = transformedSingles['app'][single][item];
        }
    }
    resData['singles'] = singles;
    logObject(resData);
    res.json(resData);
});

function logObject(obj, indent = 0) {
    const spaces = ' '.repeat(indent);
    for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object') {
            console.log(`${spaces}${key}:`);
            logObject(value, indent + 2);
        } else {
            console.log(`${spaces}${key}: ${value}`);
        }
    }
}

app.get('/min-php', (req, res) => {
    const file_path = path.join(process.cwd(), 'min-php.html');
    let file_content = fs.readFileSync(file_path, 'utf8');
    res.send(file_content);
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
