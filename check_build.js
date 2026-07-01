const { exec } = require('child_process');
const fs = require('fs');

exec('npm run build', { cwd: __dirname }, (error, stdout, stderr) => {
    fs.writeFileSync('build_output.txt', `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}\n\nERROR:\n${error}`);
    console.log('Build finished');
});
