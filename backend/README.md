# Messaging System

A comprehensive real-time messaging, calling, and video calling system built with the PERN stack (PostgreSQL, Express, React, Node.js) and modern web technologies.

## Features

### 🚀 Core Features
- **Real-time Messaging**: Instant message delivery with Socket.IO
- **Audio Calls**: High-quality voice calls with WebRTC
- **Video Calls**: HD video calls with screen sharing capabilities
- **User Authentication**: Secure JWT-based authentication
- **User Management**: Profile management and user search
- **Conversation Management**: Direct messaging with conversation history
- **Typing Indicators**: Real-time typing status
- **Online Status**: User presence and last seen tracking
- **Message History**: Persistent message storage and retrieval
- **Call History**: Track and manage call records

### 🎨 User Interface
- **Modern Design**: Beautiful, responsive UI with Tailwind CSS
- **Real-time Updates**: Live notifications and status changes
- **Mobile Responsive**: Works seamlessly on all devices
- **Dark/Light Theme**: Customizable interface themes
- **Intuitive Navigation**: Easy-to-use interface

### 🔒 Security Features
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt password encryption
- **Input Validation**: Comprehensive form validation
- **Rate Limiting**: API rate limiting for security
- **CORS Protection**: Cross-origin resource sharing protection

## Tech Stack

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web application framework
- **PostgreSQL**: Relational database
- **Socket.IO**: Real-time communication
- **JWT**: Authentication tokens
- **Bcrypt**: Password hashing
- **Helmet**: Security middleware
- **CORS**: Cross-origin resource sharing

### Frontend
- **React**: JavaScript library for UI
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Socket.IO Client**: Real-time communication
- **React Query**: Data fetching and caching
- **React Hook Form**: Form management
- **React Router**: Client-side routing
- **Lucide React**: Beautiful icons

## Prerequisites

Before running this project, make sure you have the following installed:

- **Node.js** (v16 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd messaging-system
```

### 2. Backend Setup

```bash
# Install backend dependencies
npm install

# Create a .env file in the root directory
cp env.example .env

# Edit the .env file with your database credentials
# Update the following variables:
# - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
# - JWT_SECRET (generate a strong secret)
# - PORT (default: 5000)
```

### 3. Database Setup

```bash
# Connect to PostgreSQL and create the database
psql -U postgres
CREATE DATABASE messaging_system;
\q

# Run the database schema
psql -U postgres -d messaging_system -f config/database.sql
```

### 4. Frontend Setup

```bash
# Navigate to the client directory
cd client

# Install frontend dependencies
npm install
```

## Running the Application

### Development Mode

1. **Start the Backend Server**
   ```bash
   # From the root directory
   npm run dev
   ```

2. **Start the Frontend Development Server**
   ```bash
   # From the client directory
   npm run dev
   ```

3. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

### Production Mode

1. **Build the Frontend**
   ```bash
   cd client
   npm run build
   ```

2. **Start the Production Server**
   ```bash
   # From the root directory
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:userId` - Get user by ID
- `GET /api/users/online/list` - Get online users
- `GET /api/users/search/:query` - Search users
- `GET /api/users/:userId/status` - Get user status
- `PUT /api/users/status` - Update user status

### Messages
- `GET /api/messages/conversations` - Get user conversations
- `GET /api/messages/conversation/:userId` - Get or create conversation
- `GET /api/messages/conversation/:conversationId/messages` - Get messages
- `POST /api/messages/conversation/:conversationId/messages` - Send message
- `PUT /api/messages/messages/:messageId` - Edit message
- `DELETE /api/messages/messages/:messageId` - Delete message

### Calls
- `GET /api/calls/history` - Get call history
- `GET /api/calls/stats` - Get call statistics
- `POST /api/calls` - Create new call
- `PUT /api/calls/:callId/status` - Update call status
- `GET /api/calls/:callId` - Get call details
- `DELETE /api/calls/:callId` - Delete call record

## Socket.IO Events

### Client to Server
- `authenticate` - Authenticate socket connection
- `join_room` - Join conversation room
- `leave_room` - Leave conversation room
- `send_message` - Send message
- `typing` - Start typing indicator
- `stop_typing` - Stop typing indicator
- `call_user` - Initiate call
- `call_accepted` - Accept call
- `call_rejected` - Reject call
- `call_ended` - End call
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice_candidate` - WebRTC ICE candidate

### Server to Client
- `authenticated` - Socket authenticated
- `auth_error` - Authentication error
- `receive_message` - Receive new message
- `user_typing` - User typing indicator
- `user_stop_typing` - User stopped typing
- `incoming_call` - Incoming call notification
- `call_accepted` - Call accepted
- `call_rejected` - Call rejected
- `call_ended` - Call ended

## Project Structure

```
messaging-system/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Page components
│   │   ├── services/       # API and socket services
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
├── config/                 # Database configuration
│   ├── database.js
│   └── database.sql
├── middleware/             # Express middleware
│   └── auth.js
├── routes/                 # API routes
│   ├── auth.js
│   ├── users.js
│   ├── messages.js
│   └── calls.js
├── server.js              # Main server file
├── package.json
└── README.md
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
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
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any issues or have questions, please:

1. Check the [Issues](https://github.com/yourusername/messaging-system/issues) page
2. Create a new issue with detailed information
3. Contact the maintainers

## Acknowledgments

- [Socket.IO](https://socket.io/) for real-time communication
- [WebRTC](https://webrtc.org/) for peer-to-peer communication
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [React](https://reactjs.org/) for the frontend framework
- [Express](https://expressjs.com/) for the backend framework 