// ============================================
// FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyBR8Qk2Yx3AqinAfbHYZiz91dClZM3eQAY",
  authDomain: "catchup-app-2618b.firebaseapp.com",
  projectId: "catchup-app-2618b",
  storageBucket: "catchup-app-2618b.firebasestorage.app",
  messagingSenderId: "1033626744487",
  appId: "1:1033626744487:web:e208045f33cf4c5f56cd82"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================
// USER ID MANAGEMENT
// ============================================

function getUserId() {
  let userId = localStorage.getItem('catchup_user_id');
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('catchup_user_id', userId);
  }
  return userId;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getStarRating(rating) {
  const filled = '★'.repeat(rating);
  const empty = '☆'.repeat(5 - rating);
  return filled + empty;
}

function getTimeAgo(timestamp) {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function getTopicDisplay(topic) {
  const topicMap = {
    'attendance': 'Attendance',
    'exam-info': 'Exam Info',
    'homework': 'Homework',
    'lecture-notes': 'Lecture Summary',
    'announcement': 'Announcement',
    'other': 'Other'
  };
  return topicMap[topic] || topic;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// INDEX PAGE (index.html)
// ============================================

function initIndexPage() {
  const searchForm = document.getElementById('search-form');
  if (!searchForm) return;
  
  searchForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const university = document.getElementById('university-select').value;
    const courseCode = document.getElementById('course-input').value.trim();
    
    if (!university || !courseCode) {
      alert('Please select a university and enter a course code');
      return;
    }
    
    // NORMALIZE: Remove spaces and convert to uppercase
    const normalizedCourse = courseCode.replace(/\s+/g, '').toUpperCase();
    
    localStorage.setItem('catchup_university', university);
    localStorage.setItem('catchup_course', normalizedCourse);
    window.location.href = 'class.html';
  });
}

// ============================================
// CLASS PAGE (class.html)
// ============================================

function initClassPage() {
  const feedElement = document.getElementById('feed');
  if (!feedElement) return;
  
  const university = localStorage.getItem('catchup_university');
  const course = localStorage.getItem('catchup_course');
  
  if (!university || !course) {
    window.location.href = 'index.html';
    return;
  }
  
  document.getElementById('course-name').textContent = course;
  document.getElementById('day-label').textContent = 'Today';
  document.getElementById('course-semester').textContent = 'Spring 2026';
  
  loadUpdatesFromFirebase(course);
}

function loadUpdatesFromFirebase(course) {
  const feedElement = document.getElementById('feed');
  const currentUserId = getUserId();
  
  feedElement.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px 0;">Loading updates...</p>';
  
  db.collection('updates')
    .where('course', '==', course)
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      feedElement.innerHTML = '';
      
      if (snapshot.empty) {
        feedElement.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px 0;">No updates yet. Be the first to post!</p>';
        return;
      }
      
      snapshot.forEach((doc) => {
        const update = { id: doc.id, ...doc.data() };
        const updateCard = createUpdateCard(update, currentUserId);
        feedElement.appendChild(updateCard);
      });
    }, (error) => {
      console.error('Error loading updates:', error);
      feedElement.innerHTML = '<p style="text-align: center; color: red; padding: 40px 0;">Error loading updates. Please refresh the page.</p>';
    });
}

function createUpdateCard(update, currentUserId) {
  const article = document.createElement('article');
  article.className = 'update';
  article.dataset.updateId = update.id;
  
  const isOwner = update.authorId === currentUserId;
  
  article.innerHTML = `
    <div class="update-top">
      <span class="tag tag-${update.topic}" data-topic="${update.topic}">
        ${getTopicDisplay(update.topic)}
      </span>
      <div class="update-rating" data-rating="${update.importance}">
        <span class="importance-label">Importance:</span>
        <span class="importance-value">${getStarRating(update.importance)}</span>
      </div>
    </div>
    
    <p class="update-text">${escapeHtml(update.text)}</p>
    
    <div class="update-bottom">
      <div class="update-time">
        <span class="update-timestamp" data-timestamp="${update.createdAt}">
          ${formatDate(update.createdAt)}
        </span>
        <span class="dot">•</span>
        <span class="update-timeago">${getTimeAgo(update.createdAt)}</span>
      </div>
      
      <div class="update-actions">
        <button class="update-like" data-id="${update.id}" ${(update.likedBy || []).includes(currentUserId) ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
          ${(update.likedBy || []).includes(currentUserId) ? '❤️ Liked' : 'Like'} (${update.likes || 0})
        </button>
        <button class="update-share" data-id="${update.id}">Share</button>
        ${isOwner ? `
          <button class="update-edit" data-id="${update.id}">Edit</button>
          <button class="update-delete" data-id="${update.id}">Delete</button>
        ` : ''}
      </div>
    </div>
  `;
  
  const likeBtn = article.querySelector('.update-like');
  const shareBtn = article.querySelector('.update-share');
  const editBtn = article.querySelector('.update-edit');
  const deleteBtn = article.querySelector('.update-delete');
  
  likeBtn.addEventListener('click', () => handleLike(update.id));
  shareBtn.addEventListener('click', () => handleShare(update));
  if (editBtn) editBtn.addEventListener('click', () => handleEdit(update.id));
  if (deleteBtn) deleteBtn.addEventListener('click', () => handleDelete(update.id));
  
  return article;
}

function handleLike(updateId) {
  const currentUserId = getUserId();
  const updateRef = db.collection('updates').doc(updateId);
  
  updateRef.get().then((doc) => {
    if (!doc.exists) {
      alert('Update not found');
      return;
    }
    
    const update = doc.data();
    const likedBy = update.likedBy || []; 
   
    if (likedBy.includes(currentUserId)) {
      alert('You already liked this update!');
      return;
    }
    
    
    updateRef.update({
      likes: firebase.firestore.FieldValue.increment(1),
      likedBy: firebase.firestore.FieldValue.arrayUnion(currentUserId)
    }).catch((error) => {
      console.error('Error liking update:', error);
      alert('Could not like update. Please try again.');
    });
  }).catch((error) => {
    console.error('Error getting update:', error);
  });
}

function handleShare(update) {
  const shareText = `Check out this update for ${update.course}: ${update.text.substring(0, 100)}...`;
  
  if (navigator.share) {
    navigator.share({
      title: 'CatchUp Update',
      text: shareText,
      url: window.location.href
    }).catch(() => {});
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = shareText;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      alert('Update copied to clipboard!');
    } catch (err) {}
    document.body.removeChild(textarea);
  }
}

function handleEdit(updateId) {
  const currentUserId = getUserId();
  
  db.collection('updates').doc(updateId).get().then((doc) => {
    if (!doc.exists) {
      alert('Update not found');
      return;
    }
    
    const update = doc.data();
    if (update.authorId !== currentUserId) {
      alert('You can only edit your own updates');
      return;
    }
    
    const newText = prompt('Edit your update:', update.text);
    if (newText === null || newText.trim() === '') return;
    
    db.collection('updates').doc(updateId).update({
      text: newText.trim()
    }).catch((error) => {
      console.error('Error editing update:', error);
    });
  });
}

function handleDelete(updateId) {
  if (!confirm('Are you sure you want to delete this update?')) return;
  
  const currentUserId = getUserId();
  
  db.collection('updates').doc(updateId).get().then((doc) => {
    if (!doc.exists) {
      alert('Update not found');
      return;
    }
    
    const update = doc.data();
    if (update.authorId !== currentUserId) {
      alert('You can only delete your own updates');
      return;
    }
    
    db.collection('updates').doc(updateId).delete().catch((error) => {
      console.error('Error deleting update:', error);
    });
  });
}

// ============================================
// POST PAGE (post.html)
// ============================================

function initPostPage() {
  const postForm = document.getElementById('post-form');
  if (!postForm) return;
  
  const course = localStorage.getItem('catchup_course');
  if (!course) {
    window.location.href = 'index.html';
    return;
  }
  
  document.getElementById('post-course-name').textContent = course;
  document.getElementById('post-day-label').textContent = 'Today';
  
  postForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const topic = document.getElementById('topic').value;
    const importance = parseInt(document.getElementById('importance').value);
    const text = document.getElementById('update-text').value.trim();
    
    if (!topic || !importance || !text) {
      alert('Please fill in all fields');
      return;
    }
    
    const currentUserId = getUserId();
    const newUpdate = {
      course: course,
      topic: topic,
      importance: importance,
      text: text,
      createdAt: Date.now(),
      authorId: currentUserId,
      likes: 0
    };
    
    const submitBtn = postForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';
    
    db.collection('updates').add(newUpdate)
      .then(() => {
        window.location.href = 'class.html';
      })
      .catch((error) => {
        console.error('Error posting update:', error);
        alert('Could not post update. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post update';
      });
  });
}

// ============================================
// INITIALIZE APP
// ============================================

function initApp() {
  initIndexPage();
  initClassPage();
  initPostPage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}