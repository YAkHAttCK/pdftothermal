const fs = require('fs/promises');

async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Could not remove file: ${filePath}`);
    }
  }
}

module.exports = { safeUnlink };
