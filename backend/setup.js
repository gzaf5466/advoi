const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up Messaging System...\n');

// Check if Node.js is installed
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' });
  console.log(`✅ Node.js version: ${nodeVersion.trim()}`);
} catch (error) {
  console.error('❌ Node.js is not installed. Please install Node.js v16 or higher.');
  process.exit(1);
}

// Check if npm is installed
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' });
  console.log(`✅ npm version: ${npmVersion.trim()}`);
} catch (error) {
  console.error('❌ npm is not installed. Please install npm.');
  process.exit(1);
}

// Install backend dependencies
console.log('\n📦 Installing backend dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Backend dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install backend dependencies');
  process.exit(1);
}

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('\n🔧 Creating .env file...');
  const envContent = `# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=messaging_system
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration
CLIENT_URL=http://localhost:5173

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully');
  console.log('⚠️  Please update the .env file with your database credentials and JWT secret');
} else {
  console.log('✅ .env file already exists');
}

// Install frontend dependencies
console.log('\n📦 Installing frontend dependencies...');
try {
  execSync('cd client && npm install', { stdio: 'inherit' });
  console.log('✅ Frontend dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install frontend dependencies');
  process.exit(1);
}

// Create uploads directory
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath);
  console.log('✅ Uploads directory created');
}

console.log('\n🎉 Setup completed successfully!');
console.log('\n📋 Next steps:');
console.log('1. Update the .env file with your database credentials');
console.log('2. Create the PostgreSQL database: CREATE DATABASE messaging_system;');
console.log('3. Run the database schema: psql -U postgres -d messaging_system -f config/database.sql');
console.log('4. Start the backend server: npm run dev');
console.log('5. Start the frontend server: cd client && npm run dev');
console.log('\n🌐 Access the application at: http://localhost:5173'); 