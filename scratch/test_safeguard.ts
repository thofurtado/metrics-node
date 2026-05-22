// Test script to verify the safeguard works perfectly
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_marujo';
process.env.JWT_SECRET = 'dummy-secret';

console.log('Running safeguard verification test...');

try {
    // Importing the env index where the safeguard logic is
    require('../src/env/index.ts');
    console.error('❌ FAIL: Safeguard did not block the connection!');
    process.exit(1);
} catch (err) {
    if (err.message.includes('BLOQUEIO DE SEGURANÇA')) {
        console.log('\n✅ SUCCESS: Safeguard blocked the production connection correctly!');
        console.log('Error caught:', err.message);
        process.exit(0);
    } else {
        console.error('❌ FAIL: Caught unexpected error:', err);
        process.exit(1);
    }
}
