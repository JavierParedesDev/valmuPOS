const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZF91c3VhcmlvIjoxLCJyb2wiOiJBZG1pbmlzdHJhZG9yIiwiaWRfc3VjdXJzYWwiOm51bGwsImlhdCI6MTc4MDQ2NDg3OCwiZXhwIjoxNzgwNTA4MDc4fQ.zX6mjsu7zBZoZluqfKG4Fa9Sm2FuNn4TzuZ2oUJjRDA';

async function main() {
    try {
        console.log('Sending request to /api/folios/marcar-usado...');
        const res = await fetch('http://64.176.17.147:3000/api/folios/marcar-usado', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                tipoDte: 39,
                folio: 80260
            })
        });
        const result = await res.json();
        console.log('Response:', result);
    } catch (e) {
        console.error(e);
    }
}

main();
