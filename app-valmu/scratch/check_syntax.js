
const fs = require('fs');
const acorn = require('acorn');

try {
    const code = fs.readFileSync('d:/don eduardo/valmuPOS/app-valmu/src/screens/MonitoringScreen.js', 'utf8');
    // Try parsing with acorn (ESM/JSX won't work perfectly but might show basic brace mismatches)
    acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
    console.log('Valid JS (ignoring JSX)');
} catch (e) {
    console.error('Parse error:', e.message, 'at', e.loc);
}
