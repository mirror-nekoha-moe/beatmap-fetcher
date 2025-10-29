const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const { init } = require('./pgDatabaseInit.cjs');
const { checkEnvVariables } = require('./envInit.cjs');
const { thControllerMain } = require('./threadController.cjs');

async function main() {
	console.log("[ beatmap-fetcher ]");
	await checkEnvVariables();
	await init();
	thControllerMain();
	console.log("main() execution done.");	
}
main();
