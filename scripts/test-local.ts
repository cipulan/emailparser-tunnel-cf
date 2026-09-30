import PostalMime from 'postal-mime';
import * as fs from 'fs';
import * as path from 'path';
import { parseTunnelDetails } from '../src/index';

async function test() {
    const emlPath = process.argv[2] || path.join(process.cwd(), 'sample.eml');

    if (!fs.existsSync(emlPath)) {
        console.error(`Error: Could not find email file at ${emlPath}`);
        console.log('Usage: npx tsx scripts/test-local.ts <path-to-eml>');
        process.exit(1);
    }

    console.log(`Reading email from: ${emlPath}`);
    const emlContent = fs.readFileSync(emlPath);

    const parser = new PostalMime();
    const email = await parser.parse(emlContent);

    console.log('--- Headers ---');
    console.log('Subject:', email.subject);
    console.log('From:', email.from ? `${email.from.name} <${email.from.address}>` : '(unknown)');
    console.log('Has text part:', !!email.text, '| Has html part:', !!email.html);

    const details = parseTunnelDetails(email.text || email.html || '');
    console.log('--- Extracted Tunnel Details ---');
    console.log(JSON.stringify(details, null, 2));

    const ok = details.title === 'Tunnel tunnel-name is now degraded'
        && details.name === 'tunnel-name'
        && details.id === 'aBcD1234efgh567i890j1kl234567m80'
        && details.newStatus === 'Degraded (status change)';
    console.log(ok ? '✅ All expected fields extracted' : '⚠️ Some fields did not match expected values');

    // Also verify HTML fallback path
    if (email.html) {
        const fromHtml = parseTunnelDetails(email.html);
        console.log('--- Extracted from HTML part ---');
        console.log(JSON.stringify(fromHtml, null, 2));
    }
}

test().catch((e) => {
    console.error(e);
    process.exit(1);
});
