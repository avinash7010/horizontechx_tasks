// ==========================================================================
// Sphere Single Page Application Javascript
// ==========================================================================

const API_BASE = '/api';

// Application State
let token = localStorage.getItem('sphere_token') || null;
let currentUser = null;
let activeFeedType = 'global'; // 'global' or 'following'

// DOM Elements - Shell
const appContainer = document.getElementById('app-container');
const authContainer = document.getElementById('auth-container');
const logoutBtn = document.getElementById('logout-btn');
const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarDisplayName = document.getElementById('sidebar-display-name');
const sidebarUsername = document.getElementById('sidebar-username');
const sidebarProfileBtn = document.getElementById('sidebar-profile-btn');

// DOM Elements - Navigation Tabs
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.content-view');

// DOM Elements - Auth Panels
const loginCard = document.getElementById('login-card');
const registerCard = document.getElementById('register-card');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginErrorBanner = document.getElementById('login-error-banner');
const registerErrorBanner = document.getElementById('register-error-banner');
const switchToRegisterBtn = document.getElementById('switch-to-register-btn');
const switchToLoginBtn = document.getElementById('switch-to-login-btn');

// DOM Elements - Feed Views
const createPostForm = document.getElementById('create-post-form');
const postContentInput = document.getElementById('post-content-input');
const composeAvatar = document.getElementById('compose-avatar');
const postsContainer = document.getElementById('posts-container');
const filterTabs = document.querySelectorAll('.filter-tab');
const followingFeedTab = document.getElementById('following-feed-tab');
const composeShortcutBtn = document.getElementById('compose-shortcut-btn');

// DOM Elements - Image Link Panel
const btnToggleMedia = document.getElementById('btn-toggle-media');
const mediaInputPanel = document.getElementById('media-input-panel');
const postMediaInput = document.getElementById('post-media-input');
const btnRemoveMedia = document.getElementById('btn-remove-media');

// DOM Elements - Explore View
const searchInput = document.getElementById('search-input');
const searchSubmitBtn = document.getElementById('search-submit-btn');
const searchResultsLayout = document.getElementById('search-results-layout');
const searchUsersResult = document.getElementById('search-users-result');
const searchPostsResult = document.getElementById('search-posts-result');
const exploreDefaultPrompt = document.getElementById('explore-default-prompt');
const rightSidebarSearchTrigger = document.getElementById('right-sidebar-search-trigger');

// DOM Elements - Suggestions Widget
const suggestionsContainer = document.getElementById('suggestions-container');

// DOM Elements - Profile View
const profileAvatarPic = document.getElementById('profile-avatar-pic');
const profileCoverPic = document.getElementById('profile-cover-pic');
const profileDisplayName = document.getElementById('profile-display-name');
const profileUsername = document.getElementById('profile-username');
const profileBioText = document.getElementById('profile-bio-text');
const profileJoinedDate = document.getElementById('profile-joined-date');
const profileFollowersCount = document.getElementById('profile-followers-count');
const profileFollowingCount = document.getElementById('profile-following-count');
const profilePostsCount = document.getElementById('profile-posts-count');
const profilePostsContainer = document.getElementById('profile-posts-container');
const followProfileBtn = document.getElementById('follow-profile-btn');
const editProfileBtn = document.getElementById('edit-profile-btn');
const profileBackBtn = document.getElementById('profile-back-btn');
const statsFollowersBtn = document.getElementById('stats-followers-btn');
const statsFollowingBtn = document.getElementById('stats-following-btn');

// DOM Elements - Modals
const editProfileModal = document.getElementById('edit-profile-modal');
const editProfileForm = document.getElementById('edit-profile-form');
const editProfileCloseBtn = document.getElementById('edit-profile-close-btn');
const editProfileCancelBtn = document.getElementById('edit-profile-cancel-btn');
const editDisplayName = document.getElementById('edit-display-name');
const editBio = document.getElementById('edit-bio');
const editAvatarUrl = document.getElementById('edit-avatar-url');
const editCoverUrl = document.getElementById('edit-cover-url');

const connectionsModal = document.getElementById('connections-modal');
const connectionsModalTitle = document.getElementById('connections-modal-title');
const connectionsCloseBtn = document.getElementById('connections-close-btn');
const connectionsListContainer = document.getElementById('connections-list-container');

// ==========================================
// UTILITY FUNCTIONS & HELPERS
// ==========================================

// Get authenticated request headers
function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Format relative date (e.g. "Just now", "5m ago")
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Simple HTML escaping to prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Rerender Lucide Icons
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Show error messages inside panels
function showError(banner, message) {
  banner.textContent = message;
  banner.classList.remove('hidden');
  setTimeout(() => {
    banner.classList.add('fade-out');
    setTimeout(() => {
      banner.classList.remove('fade-out');
      banner.classList.add('hidden');
    }, 300);
  }, 5000);
}

// ==========================================
// VIEW SWITCHER (SPA ROUTER)
// ==========================================

function switchTab(tabName) {
  // Update sidebar active buttons
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Switch visible views
  views.forEach(view => {
    if (view.id === `view-${tabName}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  // Perform view-specific fetching
  if (tabName === 'feed') {
    loadFeed();
  } else if (tabName === 'explore') {
    // Reset or prepare explore view
    exploreDefaultPrompt.classList.remove('hidden');
    searchResultsLayout.classList.add('hidden');
    searchInput.value = '';
  } else if (tabName === 'profile' && currentUser) {
    loadUserProfile(currentUser.username);
  }

  // Close modals upon switching tabs
  editProfileModal.classList.add('hidden');
  connectionsModal.classList.add('hidden');
}

// Bind navigation tab clicks
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tab = item.getAttribute('data-tab');
    switchTab(tab);
  });
});

// Create Post sidebar shortcut button
composeShortcutBtn.addEventListener('click', () => {
  switchTab('feed');
  postContentInput.focus();
});

// Profile Banner Back Arrow
profileBackBtn.addEventListener('click', () => {
  switchTab('feed');
});

// Search trigger shortcut on right sidebar
rightSidebarSearchTrigger.addEventListener('click', () => {
  switchTab('explore');
  searchInput.focus();
});

// ==========================================
// AUTHENTICATION FLOWS
// ==========================================

// Check if user is logged in on page load
async function checkAuth() {
  if (!token) {
    showAuthScreen();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders()
    });

    if (!res.ok) {
      throw new Error('Token verification failed');
    }

    const data = await res.json();
    currentUser = data.user;
    showAppScreen();
  } catch (err) {
    console.error('Session restoration failed:', err);
    logout();
  }
}

function showAuthScreen() {
  appContainer.classList.add('hidden');
  authContainer.classList.remove('hidden');
  switchTab('feed'); // Reset router state silently
}

function showAppScreen() {
  authContainer.classList.add('hidden');
  appContainer.classList.remove('hidden');

  // Populate sidebar widgets and forms
  sidebarAvatar.src = currentUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`;
  sidebarDisplayName.textContent = currentUser.displayName;
  sidebarUsername.textContent = `@${currentUser.username}`;
  composeAvatar.src = currentUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`;

  // Attach dynamic username to sidebar profile button
  sidebarProfileBtn.setAttribute('data-tab', 'profile');

  // Load components
  loadFeed();
  loadSuggestions();
  refreshIcons();
}

function logout() {
  localStorage.removeItem('sphere_token');
  token = null;
  currentUser = null;
  showAuthScreen();
}

logoutBtn.addEventListener('click', logout);

// Toggle Auth Cards (Login <-> Register)
switchToRegisterBtn.addEventListener('click', () => {
  loginCard.classList.remove('active');
  registerCard.classList.add('active');
});

switchToLoginBtn.addEventListener('click', () => {
  registerCard.classList.remove('active');
  loginCard.classList.add('active');
});

// Handle Login Submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameOrEmail = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('sphere_token', data.token);
    token = data.token;
    currentUser = data.user;
    
    // Clear forms
    loginForm.reset();
    showAppScreen();
  } catch (err) {
    showError(loginErrorBanner, err.message);
  }
});

// Handle Register Submission
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const displayName = document.getElementById('register-displayname').value;
  const password = document.getElementById('register-password').value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, displayName, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    localStorage.setItem('sphere_token', data.token);
    token = data.token;
    currentUser = data.user;
    
    // Clear forms
    registerForm.reset();
    showAppScreen();
  } catch (err) {
    showError(registerErrorBanner, err.message);
  }
});

// ==========================================
// COMPOSING NEW POSTS
// ==========================================

// Toggle optional media url input panel
btnToggleMedia.addEventListener('click', () => {
  mediaInputPanel.classList.toggle('hidden');
  if (!mediaInputPanel.classList.contains('hidden')) {
    postMediaInput.focus();
  }
});

btnRemoveMedia.addEventListener('click', () => {
  postMediaInput.value = '';
  mediaInputPanel.classList.add('hidden');
});

// Create Post Submit Handler
createPostForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = postContentInput.value;
  const mediaUrl = postMediaInput.value;

  try {
    const res = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content, mediaUrl })
    });

    const newPost = await res.json();

    if (!res.ok) {
      throw new Error(newPost.error || 'Failed to post');
    }

    // Reset Composer inputs
    createPostForm.reset();
    mediaInputPanel.classList.add('hidden');

    // Add newly created post dynamically to the top of feed for instant gratification
    const postHTML = renderPostCard(newPost);
    
    // If loading placeholder exists, remove it
    const noPosts = postsContainer.querySelector('.loading-state, .empty-state');
    if (noPosts) {
      postsContainer.innerHTML = '';
    }
    
    postsContainer.insertAdjacentHTML('afterbegin', postHTML);
    refreshIcons();
    attachPostListeners(document.getElementById(`post-${newPost.id}`));
  } catch (err) {
    alert(err.message);
  }
});

// ==========================================
// FEED RETRIEVAL & RENDERING
// ==========================================

// Handle filter tabs (Global vs Following)
filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFeedType = tab.getAttribute('data-feed');
    loadFeed();
  });
});

async function loadFeed() {
  postsContainer.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Exploring the sphere...</span>
    </div>
  `;

  // Hide the following feed tab if user isn't logged in (should not happen as app screen requires auth, but good guard)
  if (!currentUser) {
    followingFeedTab.style.display = 'none';
  } else {
    followingFeedTab.style.display = '';
  }

  try {
    let url = `${API_BASE}/posts`;
    if (activeFeedType === 'following') {
      url += '?feed=following';
    }

    const res = await fetch(url, { headers: getHeaders() });
    const posts = await res.json();

    if (!res.ok) {
      throw new Error(posts.error || 'Failed to load posts');
    }

    if (posts.length === 0) {
      postsContainer.innerHTML = `
        <div class="explore-hero glass-panel empty-state">
          <h3>Sphere is Quiet</h3>
          <p>${activeFeedType === 'following' ? 'No posts from people you follow yet. Search creators to expand your sphere!' : 'No one has posted yet.'}</p>
        </div>
      `;
      return;
    }

    postsContainer.innerHTML = posts.map(post => renderPostCard(post)).join('');
    refreshIcons();

    // Attach listeners to all post elements
    posts.forEach(post => {
      const el = document.getElementById(`post-${post.id}`);
      if (el) attachPostListeners(el);
    });
  } catch (err) {
    postsContainer.innerHTML = `<div class="error-banner">${err.message}</div>`;
  }
}

// Generate Post HTML
function renderPostCard(post) {
  const isMine = currentUser && post.author.id === currentUser.id;
  const deleteBtn = isMine 
    ? `<button class="btn-delete-post" title="Delete Post"><i data-lucide="trash-2"></i></button>`
    : '';

  const mediaSection = post.mediaUrl 
    ? `<div class="post-media"><img src="${escapeHTML(post.mediaUrl)}" alt="Uploaded media" onerror="this.style.display='none'"></div>`
    : '';

  return `
    <div class="post-card glass-panel" id="post-${post.id}" data-id="${post.id}">
      <div class="post-header">
        <div class="post-author-info" data-username="${post.author.username}">
          <img src="${post.author.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.author.username}`}" alt="${post.author.displayName}" class="user-avatar-sm">
          <div class="post-author-text">
            <span class="post-display-name">${escapeHTML(post.author.displayName)}</span>
            <span class="post-username-time">@${post.author.username} • ${formatRelativeTime(post.createdAt)}</span>
          </div>
        </div>
        ${deleteBtn}
      </div>

      <div class="post-body">
        <div class="post-content">${escapeHTML(post.content)}</div>
        ${mediaSection}
      </div>

      <div class="post-actions">
        <button class="action-btn action-btn-like ${post.likedByMe ? 'liked' : ''}">
          <i data-lucide="heart"></i>
          <span class="likes-count">${post.likesCount}</span>
        </button>
        <button class="action-btn action-btn-comment">
          <i data-lucide="message-square"></i>
          <span>${post.commentsCount}</span>
        </button>
      </div>

      <!-- Collapsed Comments Container -->
      <div class="post-comments-section hidden" id="comments-section-${post.id}">
        <div class="comments-list" id="comments-list-${post.id}">
          <!-- Dynamically loaded comments -->
        </div>
        <form class="comment-composer" id="comment-form-${post.id}">
          <input type="text" placeholder="Write a comment..." id="comment-input-${post.id}" required maxlength="300">
          <button type="submit" class="btn btn-primary">Send</button>
        </form>
      </div>
    </div>
  `;
}

// Bind events to single post cards (Likes, Comments Toggle, Deletion, Profile Links)
function attachPostListeners(postEl) {
  const postId = postEl.getAttribute('data-id');
  
  // Navigate to author profile
  const authorInfo = postEl.querySelector('.post-author-info');
  authorInfo.addEventListener('click', () => {
    const username = authorInfo.getAttribute('data-username');
    loadUserProfile(username);
    switchViewContainer('profile');
  });

  // Like interaction
  const likeBtn = postEl.querySelector('.action-btn-like');
  const likesCountSpan = postEl.querySelector('.likes-count');
  likeBtn.addEventListener('click', async () => {
    // Optimistic UI updates
    const currentlyLiked = likeBtn.classList.contains('liked');
    let currentLikes = parseInt(likesCountSpan.textContent);
    
    likeBtn.classList.toggle('liked');
    if (currentlyLiked) {
      likesCountSpan.textContent = Math.max(0, currentLikes - 1);
    } else {
      likesCountSpan.textContent = currentLikes + 1;
      // Triggers pop animation
      const heartIcon = likeBtn.querySelector('i');
      heartIcon.style.animation = 'none';
      setTimeout(() => { heartIcon.style.animation = ''; }, 10);
    }

    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/like`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      
      if (res.ok) {
        // Correct count if it differed from server
        likesCountSpan.textContent = data.likesCount;
        if (data.liked) {
          likeBtn.classList.add('liked');
        } else {
          likeBtn.classList.remove('liked');
        }
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error(err);
      // Revert optimistic changes
      likeBtn.classList.toggle('liked');
      likesCountSpan.textContent = currentLikes;
    }
  });

  // Toggle Comment drawer
  const commentBtn = postEl.querySelector('.action-btn-comment');
  const commentsSection = postEl.querySelector(`#comments-section-${postId}`);
  commentBtn.addEventListener('click', () => {
    const isHidden = commentsSection.classList.contains('hidden');
    commentsSection.classList.toggle('hidden');
    if (isHidden) {
      loadComments(postId);
    }
  });

  // Create Comment handler
  const commentForm = postEl.querySelector(`#comment-form-${postId}`);
  const commentInput = postEl.querySelector(`#comment-input-${postId}`);
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = commentInput.value;

    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content })
      });
      
      const newComment = await res.json();
      
      if (!res.ok) {
        throw new Error(newComment.error || 'Failed to submit comment');
      }

      // Clear input
      commentInput.value = '';

      // Append comment
      const commentList = postEl.querySelector(`#comments-list-${postId}`);
      const commentHTML = renderCommentCard(newComment);
      commentList.insertAdjacentHTML('beforeend', commentHTML);
      
      // Update comment badge count on action button
      const commentBadge = commentBtn.querySelector('span');
      commentBadge.textContent = parseInt(commentBadge.textContent) + 1;
    } catch (err) {
      alert(err.message);
    }
  });

  // Delete Post Handler
  const deleteBtn = postEl.querySelector('.btn-delete-post');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this post inside the sphere?')) return;
      
      try {
        const res = await fetch(`${API_BASE}/posts/${postId}`, {
          method: 'DELETE',
          headers: getHeaders()
        });

        if (res.ok) {
          // Animate card removal
          postEl.style.transition = 'opacity 0.25s, transform 0.25s';
          postEl.style.opacity = '0';
          postEl.style.transform = 'scale(0.9)';
          setTimeout(() => {
            postEl.remove();
            // If empty, show placeholder
            if (postsContainer.children.length === 0) {
              loadFeed();
            }
          }, 250);
        } else {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete');
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }
}

// Load comment list for a post
async function loadComments(postId) {
  const commentList = document.getElementById(`comments-list-${postId}`);
  commentList.innerHTML = `<div class="loading-state-sm"><div class="spinner-sm"></div></div>`;

  try {
    const res = await fetch(`${API_BASE}/posts/${postId}/comments`);
    const comments = await res.json();

    if (!res.ok) {
      throw new Error(comments.error);
    }

    if (comments.length === 0) {
      commentList.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-dim); padding: 8px 4px;">No comments yet. Share your thoughts!</p>`;
      return;
    }

    commentList.innerHTML = comments.map(c => renderCommentCard(c)).join('');
  } catch (err) {
    commentList.innerHTML = `<p style="font-size: 0.8rem; color: var(--color-accent);">${err.message}</p>`;
  }
}

function renderCommentCard(comment) {
  return `
    <div class="comment-card">
      <img src="${comment.author.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${comment.author.username}`}" alt="${comment.author.displayName}" class="user-avatar-sm" style="width:28px; height:28px;">
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author-name">${escapeHTML(comment.author.displayName)}</span>
          <span class="comment-author-username">@${comment.author.username}</span>
          <span class="comment-time">${formatRelativeTime(comment.createdAt)}</span>
        </div>
        <div class="comment-text">${escapeHTML(comment.content)}</div>
      </div>
    </div>
  `;
}

// Helper to switch view classes from arbitrary actions (e.g. clicking user name)
function switchViewContainer(tabName) {
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  views.forEach(view => {
    if (view.id === `view-${tabName}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });
}

// ==========================================
// WHO TO FOLLOW WIDGET & RECOMMENDATIONS
// ==========================================

async function loadSuggestions() {
  suggestionsContainer.innerHTML = `<div class="loading-state-sm"><div class="spinner-sm"></div></div>`;

  try {
    const res = await fetch(`${API_BASE}/explore/suggestions`, { headers: getHeaders() });
    const suggestions = await res.json();

    if (!res.ok) {
      throw new Error(suggestions.error);
    }

    if (suggestions.length === 0) {
      suggestionsContainer.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-dim);">No suggestions available.</p>`;
      return;
    }

    suggestionsContainer.innerHTML = suggestions.map(user => {
      return `
        <div class="suggestion-row" id="sug-${user.id}">
          <img src="${user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}" alt="${user.displayName}" class="user-avatar-sm" style="width: 32px; height: 32px;">
          <div class="suggestion-details" data-username="${user.username}">
            <span class="suggestion-name">${escapeHTML(user.displayName)}</span>
            <span class="suggestion-username">@${user.username}</span>
          </div>
          <button class="btn btn-primary btn-follow-sm" data-id="${user.id}">
            <span>Follow</span>
          </button>
        </div>
      `;
    }).join('');

    // Attach Suggestion Clicks
    suggestions.forEach(user => {
      const row = document.getElementById(`sug-${user.id}`);
      if (!row) return;

      // Click row details to view profile
      row.querySelector('.suggestion-details').addEventListener('click', () => {
        loadUserProfile(user.username);
        switchViewContainer('profile');
      });

      // Quick follow button toggle
      const folBtn = row.querySelector('.btn-follow-sm');
      folBtn.addEventListener('click', async () => {
        const currentlyFollowing = folBtn.classList.contains('following');
        folBtn.classList.toggle('following');
        folBtn.querySelector('span').textContent = currentlyFollowing ? 'Follow' : 'Following';

        try {
          const r = await fetch(`${API_BASE}/users/${user.id}/follow`, {
            method: 'POST',
            headers: getHeaders()
          });
          const d = await r.json();

          if (!r.ok) throw new Error(d.error);

          if (d.followed) {
            folBtn.classList.add('following');
            folBtn.querySelector('span').textContent = 'Following';
          } else {
            folBtn.classList.remove('following');
            folBtn.querySelector('span').textContent = 'Follow';
          }

          // If current profile is matching the target, refresh its counts
          const currentProfileUname = profileUsername.textContent.replace('@', '');
          if (currentProfileUname === user.username) {
            loadUserProfile(user.username);
          }
        } catch (err) {
          console.error(err);
          // Revert visual state
          folBtn.classList.toggle('following');
          folBtn.querySelector('span').textContent = currentlyFollowing ? 'Following' : 'Follow';
        }
      });
    });

  } catch (err) {
    suggestionsContainer.innerHTML = `<p style="color: var(--color-accent); font-size: 0.8rem;">${err.message}</p>`;
  }
}

// ==========================================
// EXPLORE VIEW: SEARCH
// ==========================================

async function performSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  exploreDefaultPrompt.classList.add('hidden');
  searchResultsLayout.classList.remove('hidden');

  searchUsersResult.innerHTML = `<div class="loading-state-sm"><div class="spinner-sm"></div></div>`;
  searchPostsResult.innerHTML = `<div class="loading-state-sm"><div class="spinner-sm"></div></div>`;

  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`, { headers: getHeaders() });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    // Render creators matching search
    if (data.users.length === 0) {
      searchUsersResult.innerHTML = `<p style="font-size: 0.9rem; color: var(--text-dim); text-align: center; padding: 20px;">No creators found.</p>`;
    } else {
      searchUsersResult.innerHTML = data.users.map(u => {
        return `
          <div class="user-search-card glass-panel" id="search-user-${u.id}" data-username="${u.username}">
            <img src="${u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}" alt="${u.displayName}" class="user-avatar-sm" style="width: 44px; height: 44px;">
            <div class="user-search-details">
              <span class="user-search-name">${escapeHTML(u.displayName)}</span>
              <span class="user-search-username">@${u.username}</span>
              <span class="user-search-bio">${escapeHTML(u.bio)}</span>
            </div>
          </div>
        `;
      }).join('');

      data.users.forEach(u => {
        const card = document.getElementById(`search-user-${u.id}`);
        card.addEventListener('click', () => {
          loadUserProfile(u.username);
          switchViewContainer('profile');
        });
      });
    }

    // Render posts matching search
    if (data.posts.length === 0) {
      searchPostsResult.innerHTML = `<p style="font-size: 0.9rem; color: var(--text-dim); text-align: center; padding: 20px;">No matching posts found.</p>`;
    } else {
      searchPostsResult.innerHTML = data.posts.map(p => renderPostCard(p)).join('');
      refreshIcons();
      data.posts.forEach(p => {
        const el = document.getElementById(`post-${p.id}`);
        if (el) attachPostListeners(el);
      });
    }

  } catch (err) {
    searchUsersResult.innerHTML = `<p class="error-banner">${err.message}</p>`;
    searchPostsResult.innerHTML = `<p class="error-banner">${err.message}</p>`;
  }
}

searchSubmitBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    performSearch();
  }
});

// ==========================================
// USER PROFILE SYSTEM
// ==========================================

let viewedUserId = null;

async function loadUserProfile(username) {
  profilePostsContainer.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Opening profile file...</span></div>`;

  try {
    const res = await fetch(`${API_BASE}/users/${username}`, { headers: getHeaders() });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Failed to fetch user');

    const profileUser = data.user;
    viewedUserId = profileUser.id;

    // Set textual details
    profileDisplayName.textContent = profileUser.displayName;
    profileUsername.textContent = `@${profileUser.username}`;
    profileBioText.textContent = profileUser.bio || 'No bio written yet.';
    profileJoinedDate.textContent = `Joined ${new Date(profileUser.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;

    profileFollowersCount.textContent = data.followersCount;
    profileFollowingCount.textContent = data.followingCount;
    profilePostsCount.textContent = data.posts.length;

    profileAvatarPic.src = profileUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${profileUser.username}`;
    profileCoverPic.src = profileUser.coverUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';

    // Show action buttons depending on whether it is mine
    const isMe = currentUser && profileUser.id === currentUser.id;
    if (isMe) {
      editProfileBtn.style.display = '';
      followProfileBtn.style.display = 'none';
    } else {
      editProfileBtn.style.display = 'none';
      followProfileBtn.style.display = '';
      
      // Update follow button text/styles
      if (data.isFollowing) {
        followProfileBtn.classList.add('btn-outline');
        followProfileBtn.classList.remove('btn-primary');
        followProfileBtn.textContent = 'Unfollow';
      } else {
        followProfileBtn.classList.remove('btn-outline');
        followProfileBtn.classList.add('btn-primary');
        followProfileBtn.textContent = 'Follow';
      }
    }

    // Render User Posts
    if (data.posts.length === 0) {
      profilePostsContainer.innerHTML = `<p style="font-size: 0.95rem; color: var(--text-dim); text-align: center; padding: 40px;">No activity posts yet.</p>`;
      return;
    }

    profilePostsContainer.innerHTML = data.posts.map(p => renderPostCard(p)).join('');
    refreshIcons();
    data.posts.forEach(p => {
      const el = document.getElementById(`post-${p.id}`);
      if (el) attachPostListeners(el);
    });

  } catch (err) {
    profilePostsContainer.innerHTML = `<div class="error-banner">${err.message}</div>`;
  }
}

// Follow/Unfollow toggle click on Profile card
followProfileBtn.addEventListener('click', async () => {
  if (!viewedUserId) return;

  const followingCurrentState = followProfileBtn.textContent.trim() === 'Unfollow';
  
  // Optimistic profile update
  if (followingCurrentState) {
    followProfileBtn.textContent = 'Follow';
    followProfileBtn.classList.remove('btn-outline');
    followProfileBtn.classList.add('btn-primary');
    profileFollowersCount.textContent = Math.max(0, parseInt(profileFollowersCount.textContent) - 1);
  } else {
    followProfileBtn.textContent = 'Unfollow';
    followProfileBtn.classList.add('btn-outline');
    followProfileBtn.classList.remove('btn-primary');
    profileFollowersCount.textContent = parseInt(profileFollowersCount.textContent) + 1;
  }

  try {
    const res = await fetch(`${API_BASE}/users/${viewedUserId}/follow`, {
      method: 'POST',
      headers: getHeaders()
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Sync state
    profileFollowersCount.textContent = data.followersCount;
    if (data.followed) {
      followProfileBtn.textContent = 'Unfollow';
      followProfileBtn.classList.add('btn-outline');
      followProfileBtn.classList.remove('btn-primary');
    } else {
      followProfileBtn.textContent = 'Follow';
      followProfileBtn.classList.remove('btn-outline');
      followProfileBtn.classList.add('btn-primary');
    }

    // Refresh Suggestions list on right sidebar
    loadSuggestions();
  } catch (err) {
    console.error(err);
    // Revert state
    if (followingCurrentState) {
      followProfileBtn.textContent = 'Unfollow';
      followProfileBtn.classList.add('btn-outline');
      followProfileBtn.classList.remove('btn-primary');
      profileFollowersCount.textContent = parseInt(profileFollowersCount.textContent) + 1;
    } else {
      followProfileBtn.textContent = 'Follow';
      followProfileBtn.classList.remove('btn-outline');
      followProfileBtn.classList.add('btn-primary');
      profileFollowersCount.textContent = Math.max(0, parseInt(profileFollowersCount.textContent) - 1);
    }
  }
});

// ==========================================
// EDIT PROFILE SETTINGS DIALOG
// ==========================================

editProfileBtn.addEventListener('click', () => {
  if (!currentUser) return;

  // Prepopulate form values
  editDisplayName.value = currentUser.displayName;
  editBio.value = currentUser.bio || '';
  editAvatarUrl.value = currentUser.avatarUrl || '';
  editCoverUrl.value = currentUser.coverUrl || '';

  // Open modal
  editProfileModal.classList.remove('hidden');
});

function closeEditModal() {
  editProfileModal.classList.add('hidden');
}

editProfileCloseBtn.addEventListener('click', closeEditModal);
editProfileCancelBtn.addEventListener('click', closeEditModal);

editProfileForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const body = {
    displayName: editDisplayName.value.trim(),
    bio: editBio.value.trim(),
    avatarUrl: editAvatarUrl.value.trim() || null,
    coverUrl: editCoverUrl.value.trim() || null
  };

  try {
    const res = await fetch(`${API_BASE}/users/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile');

    // Update global current user info
    currentUser = data.user;

    // Refresh layout views
    closeEditModal();
    showAppScreen(); // Syncs sidebar and templates
    loadUserProfile(currentUser.username); // Refresh profile details view
  } catch (err) {
    alert(err.message);
  }
});

// ==========================================
// CONNECTIONS (FOLLOWERS / FOLLOWING) MODAL
// ==========================================

async function loadConnections(type) {
  const targetUsername = profileUsername.textContent.replace('@', '');
  connectionsModalTitle.textContent = type === 'followers' ? 'Followers' : 'Following';
  connectionsListContainer.innerHTML = `<div class="loading-state-sm"><div class="spinner-sm"></div></div>`;
  connectionsModal.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/users/${targetUsername}/${type}`);
    const list = await res.json();

    if (!res.ok) throw new Error(list.error);

    if (list.length === 0) {
      connectionsListContainer.innerHTML = `<p style="font-size: 0.9rem; color: var(--text-dim); text-align: center; padding: 20px;">No connections yet.</p>`;
      return;
    }

    connectionsListContainer.innerHTML = list.map(user => {
      return `
        <div class="connection-user-row" id="conn-${user.id}" data-username="${user.username}" style="cursor:pointer;">
          <img src="${user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}" alt="${user.displayName}" class="user-avatar-sm" style="width: 38px; height: 38px;">
          <div class="suggestion-details">
            <span class="suggestion-name">${escapeHTML(user.displayName)}</span>
            <span class="suggestion-username">@${user.username}</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach navigation click to rows
    list.forEach(user => {
      const row = document.getElementById(`conn-${user.id}`);
      row.addEventListener('click', () => {
        loadUserProfile(user.username);
        connectionsModal.classList.add('hidden');
        switchViewContainer('profile');
      });
    });

  } catch (err) {
    connectionsListContainer.innerHTML = `<p style="color: var(--color-accent); font-size: 0.85rem; padding: 12px;">${err.message}</p>`;
  }
}

statsFollowersBtn.addEventListener('click', () => loadConnections('followers'));
statsFollowingBtn.addEventListener('click', () => loadConnections('following'));
connectionsCloseBtn.addEventListener('click', () => connectionsModal.classList.add('hidden'));

// Close modals when clicking overlay
window.addEventListener('click', (e) => {
  if (e.target === editProfileModal) {
    closeEditModal();
  }
  if (e.target === connectionsModal) {
    connectionsModal.classList.add('hidden');
  }
});

// Boot the Application Check
checkAuth();
