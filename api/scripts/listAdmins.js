const { connectDB, getDB, closeDB } = require('../db');

async function listAdmins() {
    try {
        await connectDB();
        const db = getDB();

        console.log('Fetching admin users...');
        const admins = await db.collection('admin').find({}).toArray();

        if (admins.length === 0) {
            console.log('No admin users found in the database.');
        } else {
            console.log('Admin users:');
            admins.forEach(admin => {
                console.log(`- Username: ${admin.username}, ID: ${admin._id}`);
            });
        }
    } catch (error) {
        console.error('Error listing admins:', error);
        process.exit(1); // Exit with an error code
    } finally {
        await closeDB();
        process.exit(0); // Exit successfully
    }
}

listAdmins();
