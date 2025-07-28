# Postman Collection for Chat App Backend

This document explains how to use the complete Postman collection for testing all endpoints of the Chat App Backend.

## 📁 Files Included

- `Chat-App-Backend.postman_collection.json` - Complete Postman collection
- `POSTMAN_COLLECTION_README.md` - This guide

## 🚀 How to Import

1. **Open Postman**
2. **Click "Import"** button (top left)
3. **Choose "File"** tab
4. **Select** `Chat-App-Backend.postman_collection.json`
5. **Click "Import"**

## 🔧 Setup Environment Variables

After importing, you need to set up environment variables:

### 1. Create Environment
1. Click the **gear icon** (⚙️) in the top right
2. Click **"Add"** to create a new environment
3. Name it **"Chat App Backend"**

### 2. Add Variables
Add these variables to your environment:

| Variable Name | Initial Value | Description |
|---------------|---------------|-------------|
| `base_url` | `http://localhost:5000` | Your server URL |
| `access_token` | (leave empty) | JWT access token (auto-filled after login) |
| `refresh_token` | (leave empty) | JWT refresh token (auto-filled after login) |
| `user_id` | (leave empty) | Current user ID |
| `user_id_1` | (leave empty) | Test user 1 ID |
| `user_id_2` | (leave empty) | Test user 2 ID |
| `recipient_id` | (leave empty) | Recipient user ID for private chats |
| `group_id` | (leave empty) | Group ID for group operations |
| `message_id` | (leave empty) | Message ID for message operations |
| `member_id` | (leave empty) | Member ID for group member operations |
| `admin_id` | (leave empty) | Admin ID for group admin operations |

### 3. Select Environment
- Select your created environment from the dropdown in the top right

## 📋 Collection Structure

The collection is organized into 4 main folders:

### 🔐 Authentication
- **Register User** - Create new account
- **Login User** - Sign in and get tokens
- **Logout** - Sign out and invalidate tokens
- **Refresh Token** - Get new access token
- **Setup 2FA** - Enable two-factor authentication
- **Verify 2FA** - Complete 2FA setup
- **Get Profile** - View user profile
- **Update Profile** - Modify profile information
- **Change Password** - Update password

### 💬 Chat
- **Get Private Messages** - Retrieve private chat messages
- **Get Group Messages** - Retrieve group chat messages
- **Get User Chats** - Get all user's chats
- **Search Messages** - Basic message search
- **Advanced Message Search** - Search with filters
- **Pin Message** - Pin message in group
- **Edit Message** - Modify message content
- **Delete Message** - Remove message
- **Upload File** - Upload files to chat

### 👥 Groups
- **Create Group** - Create new group
- **Get Groups** - List user's groups
- **Get Group Details** - View specific group info
- **Update Group** - Modify group settings
- **Delete Group** - Remove group
- **Add Member** - Add user to group
- **Remove Member** - Remove user from group
- **Add Admin** - Grant admin privileges
- **Remove Admin** - Revoke admin privileges

### 📊 Health
- **Health Check** - Monitor application status

## 🧪 Testing Workflow

### Step 1: Setup Test Users
1. **Register User 1**
   - Use the "Register User" request
   - Copy the returned `user_id` to `user_id_1` variable
   - Copy the `access_token` to `access_token` variable

2. **Register User 2**
   - Use the "Register User" request again
   - Copy the returned `user_id` to `user_id_2` variable
   - Copy the `recipient_id` to `recipient_id` variable

### Step 2: Test Authentication
1. **Login** with User 1 credentials
2. **Get Profile** to verify authentication
3. **Setup 2FA** (optional)
4. **Update Profile** to test profile management

### Step 3: Test Chat Features
1. **Upload File** to test file upload
2. **Get Private Messages** to see message history
3. **Search Messages** to test search functionality
4. **Advanced Message Search** with filters

### Step 4: Test Group Features
1. **Create Group** with both users
2. **Get Groups** to see created group
3. **Get Group Details** for specific group info
4. **Add Member** to test member management
5. **Add Admin** to test admin management

### Step 5: Test Message Operations
1. **Pin Message** in group
2. **Edit Message** to modify content
3. **Delete Message** to remove message

## 🔄 Automated Token Management

To automatically update tokens after login:

1. **In the "Login User" request**, go to the **"Tests"** tab
2. **Add this script**:

```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("access_token", response.data.tokens.accessToken);
    pm.environment.set("refresh_token", response.data.tokens.refreshToken);
    pm.environment.set("user_id", response.data.user.id);
}
```

3. **In the "Register User" request**, go to the **"Tests"** tab
4. **Add this script**:

```javascript
if (pm.response.code === 201) {
    const response = pm.response.json();
    pm.environment.set("access_token", response.data.tokens.accessToken);
    pm.environment.set("refresh_token", response.data.tokens.refreshToken);
    pm.environment.set("user_id", response.data.user.id);
}
```

## 📝 Example Test Scenarios

### Scenario 1: Complete User Registration and Login
1. Register User → Get tokens automatically
2. Get Profile → Verify user data
3. Update Profile → Test profile modification
4. Change Password → Test password update

### Scenario 2: Private Messaging Flow
1. Register two users
2. Upload file with User 1
3. Get private messages between users
4. Search messages with keywords
5. Edit a message
6. Delete a message

### Scenario 3: Group Management Flow
1. Create group with multiple users
2. Add members to group
3. Promote member to admin
4. Get group messages
5. Pin important messages
6. Remove members
7. Delete group

### Scenario 4: Advanced Search and Filtering
1. Create messages with different file types
2. Search messages by content
3. Use advanced search with date filters
4. Filter by file type
5. Test pagination

## 🚨 Common Issues and Solutions

### Issue: 401 Unauthorized
- **Solution**: Make sure you're logged in and `access_token` is set
- **Check**: Verify the token hasn't expired

### Issue: 400 Bad Request
- **Solution**: Check request body format and required fields
- **Check**: Ensure all required parameters are provided

### Issue: 403 Forbidden
- **Solution**: Verify you have proper permissions
- **Check**: Ensure you're an admin for group operations

### Issue: 404 Not Found
- **Solution**: Check if IDs are correct
- **Check**: Verify the resource exists

### Issue: 429 Too Many Requests
- **Solution**: Wait before making more requests
- **Check**: Rate limiting is active

## 🔧 Customization Tips

### Add Pre-request Scripts
For requests that need specific data:

```javascript
// Set current timestamp
pm.environment.set("timestamp", new Date().toISOString());

// Generate random data
pm.environment.set("random_id", Math.random().toString(36).substr(2, 9));
```

### Add Test Scripts
For automated testing:

```javascript
// Test response status
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Test response structure
pm.test("Response has success field", function () {
    const response = pm.response.json();
    pm.expect(response).to.have.property('success');
});
```

### Environment-Specific URLs
Create different environments for:
- **Development**: `http://localhost:5000`
- **Staging**: `https://staging-api.yourapp.com`
- **Production**: `https://api.yourapp.com`

## 📊 Monitoring and Debugging

### View Request/Response
- Use the **"Console"** tab in Postman to see detailed logs
- Check **"Headers"** tab for authentication tokens
- Review **"Body"** tab for request/response data

### Environment Variables
- Use the **"Environment Quick Look"** to see all variables
- Click the **eye icon** to view current values

### Collection Runner
- Use **"Collection Runner"** to run multiple requests
- Set up **"Data"** file for bulk testing
- Configure **"Iterations"** for load testing

## 🎯 Best Practices

1. **Always test authentication first**
2. **Use environment variables for dynamic data**
3. **Add test scripts for validation**
4. **Keep tokens secure and don't share them**
5. **Test both success and error scenarios**
6. **Use descriptive request names**
7. **Organize requests logically**
8. **Document any special requirements**

## 📞 Support

If you encounter issues:
1. Check the main README.md for API documentation
2. Verify your server is running
3. Check environment variables are set correctly
4. Review request/response in Postman console
5. Ensure all required fields are provided

---

**Happy Testing! 🚀** 