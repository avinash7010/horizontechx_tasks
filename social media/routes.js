const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'sphere-secret-key-12345';

// Authentication Middleware
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.userId = decoded.userId;
    next();
  });
}

// Optional Auth Middleware (to attach userId if present, but not enforce it)
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      req.userId = decoded.userId;
    }
    next();
  });
}

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Register
router.post('/auth/register', async (req, res) => {
  const { username, email, password, displayName, bio } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = email.trim().toLowerCase();

  try {
    const db = await getDb();

    // Check if user exists
    const existingUser = await db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [cleanUsername, cleanEmail]
    );

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash Password
    const passwordHash = await bcrypt.hash(password, 10);

    // Default Avatars and Cover Photos (vibrant abstract assets from Unsplash)
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;
    const coverUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';

    // Insert User
    const result = await db.run(
      `INSERT INTO users (username, email, password_hash, display_name, bio, avatar_url, cover_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cleanUsername, cleanEmail, passwordHash, displayName || username, bio || '', avatarUrl, coverUrl]
    );

    const userId = result.lastID;
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: userId,
        username: cleanUsername,
        email: cleanEmail,
        displayName: displayName || username,
        bio: bio || '',
        avatarUrl,
        coverUrl
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred during registration' });
  }
});

// Login
router.post('/auth/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  const identity = usernameOrEmail.trim().toLowerCase();

  try {
    const db = await getDb();

    // Find User
    const user = await db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [identity, identity]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    // Compare Password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        coverUrl: user.cover_url
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred during login' });
  }
});

// Get Current User Info
router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.get(
      'SELECT id, username, email, display_name as displayName, bio, avatar_url as avatarUrl, cover_url as coverUrl FROM users WHERE id = ?',
      [req.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error occurred' });
  }
});

// ==========================================
// FEED & POST ENDPOINTS
// ==========================================

// Get All Posts (with dynamic fields: likesCount, commentsCount, likedByMe)
router.get('/posts', optionalAuthenticate, async (req, res) => {
  const feedType = req.query.feed; // 'following' or undefined (global)
  const viewerId = req.userId || null;

  try {
    const db = await getDb();
    let query = '';
    const params = [];

    if (feedType === 'following' && viewerId) {
      // Show only posts from users they follow
      query = `
        SELECT p.*, 
               u.username, u.display_name, u.avatar_url,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as liked_by_me
        FROM posts p
        JOIN users u ON p.user_id = u.id
        JOIN follows f ON p.user_id = f.following_id
        WHERE f.follower_id = ?
        ORDER BY p.created_at DESC
      `;
      params.push(viewerId, viewerId);
    } else {
      // Global feed
      query = `
        SELECT p.*, 
               u.username, u.display_name, u.avatar_url,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
               (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
               (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as liked_by_me
        FROM posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
      `;
      params.push(viewerId);
    }

    const posts = await db.all(query, params);

    // Format output
    const formattedPosts = posts.map(p => ({
      id: p.id,
      content: p.content,
      mediaUrl: p.media_url,
      createdAt: p.created_at,
      author: {
        id: p.user_id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url
      },
      likesCount: p.likes_count,
      commentsCount: p.comments_count,
      likedByMe: !!p.liked_by_me
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve feed' });
  }
});

// Create Post
router.post('/posts', authenticateToken, async (req, res) => {
  const { content, mediaUrl } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Post content cannot be empty' });
  }

  try {
    const db = await getDb();
    const result = await db.run(
      'INSERT INTO posts (user_id, content, media_url) VALUES (?, ?, ?)',
      [req.userId, content, mediaUrl || null]
    );

    const newPostId = result.lastID;

    // Fetch the inserted post with complete author data
    const postData = await db.get(
      `SELECT p.*, u.username, u.display_name, u.avatar_url
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = ?`,
      [newPostId]
    );

    res.status(201).json({
      id: postData.id,
      content: postData.content,
      mediaUrl: postData.media_url,
      createdAt: postData.created_at,
      author: {
        id: postData.user_id,
        username: postData.username,
        displayName: postData.display_name,
        avatarUrl: postData.avatar_url
      },
      likesCount: 0,
      commentsCount: 0,
      likedByMe: false
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Delete Post
router.delete('/posts/:id', authenticateToken, async (req, res) => {
  const postId = req.params.id;

  try {
    const db = await getDb();

    // Check if post belongs to user
    const post = await db.get('SELECT user_id FROM posts WHERE id = ?', [postId]);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.user_id !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this post' });
    }

    await db.run('DELETE FROM posts WHERE id = ?', [postId]);
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ==========================================
// LIKES ENDPOINTS
// ==========================================

// Toggle Like
router.post('/posts/:id/like', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.userId;

  try {
    const db = await getDb();

    // Check if post exists
    const post = await db.get('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if already liked
    const existingLike = await db.get(
      'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
      [userId, postId]
    );

    let liked = false;
    if (existingLike) {
      // Unlike
      await db.run('DELETE FROM likes WHERE id = ?', [existingLike.id]);
    } else {
      // Like
      await db.run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [userId, postId]);
      liked = true;
    }

    // Get current likes count
    const likesCountResult = await db.get('SELECT COUNT(*) as count FROM likes WHERE post_id = ?', [postId]);

    res.json({
      liked,
      likesCount: likesCountResult.count
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to like/unlike post' });
  }
});

// ==========================================
// COMMENTS ENDPOINTS
// ==========================================

// Get comments for a post
router.get('/posts/:id/comments', async (req, res) => {
  const postId = req.params.id;

  try {
    const db = await getDb();
    
    // Check if post exists
    const post = await db.get('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comments = await db.all(
      `SELECT c.*, u.username, u.display_name, u.avatar_url
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`,
      [postId]
    );

    const formattedComments = comments.map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      author: {
        id: c.user_id,
        username: c.username,
        displayName: c.display_name,
        avatarUrl: c.avatar_url
      }
    }));

    res.json(formattedComments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add comment to a post
router.post('/posts/:id/comments', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content cannot be empty' });
  }

  try {
    const db = await getDb();

    // Check if post exists
    const post = await db.get('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Insert Comment
    const result = await db.run(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [postId, req.userId, content.trim()]
    );

    const commentId = result.lastID;

    // Retrieve the newly created comment with author info
    const commentData = await db.get(
      `SELECT c.*, u.username, u.display_name, u.avatar_url
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [commentId]
    );

    res.status(201).json({
      id: commentData.id,
      content: commentData.content,
      createdAt: commentData.created_at,
      author: {
        id: commentData.user_id,
        username: commentData.username,
        displayName: commentData.display_name,
        avatarUrl: commentData.avatar_url
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ==========================================
// USER PROFILE & FOLLOW SYSTEM
// ==========================================

// Get user profile (with posts, follower count, following count, isFollowing)
router.get('/users/:username', optionalAuthenticate, async (req, res) => {
  const targetUsername = req.params.username.trim().toLowerCase();
  const viewerId = req.userId || null;

  try {
    const db = await getDb();

    // Fetch user details
    const user = await db.get(
      'SELECT id, username, display_name, bio, avatar_url, cover_url, created_at FROM users WHERE username = ?',
      [targetUsername]
    );

    if (!user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Fetch Follower & Following Counts
    const followersCountResult = await db.get(
      'SELECT COUNT(*) as count FROM follows WHERE following_id = ?',
      [user.id]
    );
    const followingCountResult = await db.get(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = ?',
      [user.id]
    );

    // Check if logged in user is following this user
    let isFollowing = false;
    if (viewerId && viewerId !== user.id) {
      const followRecord = await db.get(
        'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
        [viewerId, user.id]
      );
      isFollowing = !!followRecord;
    }

    // Fetch User's Posts
    const userPosts = await db.all(
      `SELECT p.*,
              u.username, u.display_name, u.avatar_url,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as liked_by_me
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [viewerId, user.id]
    );

    const formattedPosts = userPosts.map(p => ({
      id: p.id,
      content: p.content,
      mediaUrl: p.media_url,
      createdAt: p.created_at,
      author: {
        id: p.user_id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url
      },
      likesCount: p.likes_count,
      commentsCount: p.comments_count,
      likedByMe: !!p.liked_by_me
    }));

    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        coverUrl: user.cover_url,
        createdAt: user.created_at
      },
      followersCount: followersCountResult.count,
      followingCount: followingCountResult.count,
      isFollowing,
      posts: formattedPosts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// Update Profile
router.put('/users/profile', authenticateToken, async (req, res) => {
  const { displayName, bio, avatarUrl, coverUrl } = req.body;

  try {
    const db = await getDb();

    // Get current profile settings to merge
    const currentUser = await db.get('SELECT * FROM users WHERE id = ?', [req.userId]);

    const updatedDisplayName = displayName !== undefined ? displayName.trim() : currentUser.display_name;
    const updatedBio = bio !== undefined ? bio.trim() : currentUser.bio;
    const updatedAvatar = avatarUrl !== undefined ? avatarUrl.trim() : currentUser.avatar_url;
    const updatedCover = coverUrl !== undefined ? coverUrl.trim() : currentUser.cover_url;

    await db.run(
      `UPDATE users 
       SET display_name = ?, bio = ?, avatar_url = ?, cover_url = ? 
       WHERE id = ?`,
      [updatedDisplayName, updatedBio, updatedAvatar, updatedCover, req.userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: req.userId,
        username: currentUser.username,
        email: currentUser.email,
        displayName: updatedDisplayName,
        bio: updatedBio,
        avatarUrl: updatedAvatar,
        coverUrl: updatedCover
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Toggle Follow
router.post('/users/:id/follow', authenticateToken, async (req, res) => {
  const followingId = parseInt(req.params.id);
  const followerId = req.userId;

  if (followingId === followerId) {
    return res.status(400).json({ error: 'You cannot follow yourself' });
  }

  try {
    const db = await getDb();

    // Check if target user exists
    const targetUser = await db.get('SELECT id FROM users WHERE id = ?', [followingId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User to follow not found' });
    }

    // Check if already following
    const existingFollow = await db.get(
      'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
      [followerId, followingId]
    );

    let followed = false;
    if (existingFollow) {
      // Unfollow
      await db.run('DELETE FROM follows WHERE id = ?', [existingFollow.id]);
    } else {
      // Follow
      await db.run(
        'INSERT INTO follows (follower_id, following_id) VALUES (?, ?)',
        [followerId, followingId]
      );
      followed = true;
    }

    // Get updated followers count
    const followersCountResult = await db.get(
      'SELECT COUNT(*) as count FROM follows WHERE following_id = ?',
      [followingId]
    );

    res.json({
      followed,
      followersCount: followersCountResult.count
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to follow/unfollow user' });
  }
});

// Get user followers list
router.get('/users/:username/followers', async (req, res) => {
  const username = req.params.username.trim().toLowerCase();

  try {
    const db = await getDb();

    const user = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const followers = await db.all(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = ?`,
      [user.id]
    );

    res.json(followers.map(f => ({
      id: f.id,
      username: f.username,
      displayName: f.display_name,
      avatarUrl: f.avatar_url,
      bio: f.bio
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve followers' });
  }
});

// Get user following list
router.get('/users/:username/following', async (req, res) => {
  const username = req.params.username.trim().toLowerCase();

  try {
    const db = await getDb();

    const user = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const following = await db.all(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = ?`,
      [user.id]
    );

    res.json(following.map(f => ({
      id: f.id,
      username: f.username,
      displayName: f.display_name,
      avatarUrl: f.avatar_url,
      bio: f.bio
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve following list' });
  }
});

// ==========================================
// EXPLORE & SEARCH ENDPOINTS
// ==========================================

// Get user suggestions to follow
router.get('/explore/suggestions', optionalAuthenticate, async (req, res) => {
  const viewerId = req.userId || null;

  try {
    const db = await getDb();
    let query = '';
    const params = [];

    if (viewerId) {
      // Suggest users they don't follow, excluding themselves
      query = `
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
        FROM users u
        WHERE u.id != ? 
          AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
        ORDER BY RANDOM()
        LIMIT 4
      `;
      params.push(viewerId, viewerId);
    } else {
      // Just return some random users
      query = `
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
        FROM users u
        ORDER BY RANDOM()
        LIMIT 4
      `;
    }

    const suggestions = await db.all(query, params);
    
    res.json(suggestions.map(s => ({
      id: s.id,
      username: s.username,
      displayName: s.display_name,
      avatarUrl: s.avatar_url,
      bio: s.bio
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// General Search (users and posts)
router.get('/search', optionalAuthenticate, async (req, res) => {
  const queryText = req.query.q ? req.query.q.trim() : '';
  const viewerId = req.userId || null;

  if (!queryText) {
    return res.json({ users: [], posts: [] });
  }

  try {
    const db = await getDb();
    const searchPattern = `%${queryText}%`;

    // Search Users
    const users = await db.all(
      `SELECT id, username, display_name, avatar_url, bio
       FROM users
       WHERE username LIKE ? OR display_name LIKE ?
       LIMIT 10`,
      [searchPattern, searchPattern]
    );

    // Search Posts
    const posts = await db.all(
      `SELECT p.*,
              u.username, u.display_name, u.avatar_url,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as liked_by_me
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.content LIKE ?
       ORDER BY p.created_at DESC
       LIMIT 10`,
      [viewerId, searchPattern]
    );

    const formattedPosts = posts.map(p => ({
      id: p.id,
      content: p.content,
      mediaUrl: p.media_url,
      createdAt: p.created_at,
      author: {
        id: p.user_id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url
      },
      likesCount: p.likes_count,
      commentsCount: p.comments_count,
      likedByMe: !!p.liked_by_me
    }));

    res.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        bio: u.bio
      })),
      posts: formattedPosts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
