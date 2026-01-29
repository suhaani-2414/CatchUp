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
    const professor = document.getElementById('professor-input') ? document.getElementById('professor-input').value.trim() : '';
    
    if (!university || !courseCode) {
      alert('Please select a university and enter a course code');
      return;
    }
    
    const normalizedCourse = courseCode.replace(/\s+/g, '').toUpperCase();
    const normalizedProfessor = professor.trim();
    
    localStorage.setItem('catchup_university', university);
    localStorage.setItem('catchup_course', normalizedCourse);
    localStorage.setItem('catchup_professor', normalizedProfessor);
    
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

function loadLatestUpdates(myClasses) {
  const feedElement = document.getElementById('latest-feed');
  const currentUserId = getUserId();

  const courseCodes = [...new Set(myClasses.map((c) => c.course))];

  db.collection('updates')
    .where('course', 'in', courseCodes.slice(0, 10)) // only filter here
    .onSnapshot(
      (snapshot) => {
        const allUpdates = [];

        snapshot.forEach((doc) => {
          const update = { id: doc.id, ...doc.data() };
          allUpdates.push(update);
        });

        // Filter by professor + course based on saved classes
        const filtered = allUpdates.filter((update) => {
          const match = myClasses.find((c) => {
            if (c.professor && update.professor) {
              return (
                c.course === update.course &&
                c.professor === update.professor
              );
            }
            return c.course === update.course;
          });
          return Boolean(match);
        });

        // Sort newest → oldest
        filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Optional: keep only top 50
        const top = filtered.slice(0, 50);

        feedElement.innerHTML = '';

        if (top.length === 0) {
          feedElement.innerHTML =
            '<p style="text-align: center; color: var(--text-muted); padding: 40px 0;">No updates yet for your classes!</p>';
          return;
        }

        top.forEach((update) => {
          const card = createUpdateCard(update, currentUserId);
          feedElement.appendChild(card);
        });
      },
      (error) => {
        console.error('Error loading updates:', error);
        feedElement.innerHTML =
          '<p style="text-align: center; color: red; padding: 40px 0;">Error loading updates. Please refresh the page.</p>';
      }
    );
}

function createUpdateCard(update, currentUserId) {
  const article = document.createElement('article');
  article.className = 'update';
  article.dataset.updateId = update.id;
  
  const isOwner = update.authorId === currentUserId;
  const hasLiked = (update.likedBy || []).includes(currentUserId);
  
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
        <button class="update-like" data-id="${update.id}" style="${hasLiked ? 'color: #d32f2f;' : ''}">
          ${hasLiked ? '❤️ Unlike' : '🤍 Like'} (${update.likes || 0})
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
   
    // Check if user already liked - if so, UNLIKE
    if (likedBy.includes(currentUserId)) {
      // Unlike: remove user from array and decrement likes
      updateRef.update({
        likes: firebase.firestore.FieldValue.increment(-1),
        likedBy: firebase.firestore.FieldValue.arrayRemove(currentUserId)
      }).catch((error) => {
        console.error('Error unliking update:', error);
        alert('Could not unlike update. Please try again.');
      });
    } else {
      // Like: add user to array and increment likes
      updateRef.update({
        likes: firebase.firestore.FieldValue.increment(1),
        likedBy: firebase.firestore.FieldValue.arrayUnion(currentUserId)
      }).catch((error) => {
        console.error('Error liking update:', error);
        alert('Could not like update. Please try again.');
      });
    }
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
  const professor = localStorage.getItem('catchup_professor') || '';
  
  if (!course) {
    window.location.href = 'index.html';
    return;
  }
  
  document.getElementById('post-course-name').textContent = course + (professor ? ` (Prof. ${professor})` : '');
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
      professor: professor || null,
      topic: topic,
      importance: importance,
      text: text,
      createdAt: Date.now(),
      authorId: currentUserId,
      likes: 0,
      likedBy: []
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
// MY CLASSES MANAGEMENT
// ============================================

function getMyClasses() {
  const classesJSON = localStorage.getItem('my_classes');
  return classesJSON ? JSON.parse(classesJSON) : [];
}

function saveMyClasses(classes) {
  localStorage.setItem('my_classes', JSON.stringify(classes));
}

function addClass(course, professor) {
  const classes = getMyClasses();
  const normalizedCourse = course.replace(/\s+/g, '').toUpperCase();
  const normalizedProfessor = professor ? professor.trim() : null;
  
  // Check if class already exists
  const exists = classes.some(c => 
    c.course === normalizedCourse && c.professor === normalizedProfessor
  );
  
  if (exists) {
    alert('This class is already in your list!');
    return false;
  }
  
  classes.push({
    course: normalizedCourse,
    professor: normalizedProfessor,
    addedAt: Date.now()
  });
  
  saveMyClasses(classes);
  return true;
}

function removeClass(course, professor) {
  let classes = getMyClasses();
  classes = classes.filter(c => 
    !(c.course === course && c.professor === professor)
  );
  saveMyClasses(classes);
}

// ============================================
// MY CLASSES PAGE (my-classes.html)
// ============================================

function initMyClassesPage() {
  const addClassForm = document.getElementById('add-class-form');
  const myClassesList = document.getElementById('my-classes-list');
  
  if (!addClassForm || !myClassesList) return;
  
  // Handle add class form
  addClassForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const course = document.getElementById('new-course-input').value.trim();
    const professor = document.getElementById('new-professor-input').value.trim();
    
    if (!course) {
      alert('Please enter a course code');
      return;
    }
    
    if (addClass(course, professor || null)) {
      document.getElementById('new-course-input').value = '';
      document.getElementById('new-professor-input').value = '';
      renderMyClasses();
    }
  });
  
  // Initial render
  renderMyClasses();
}

function renderMyClasses() {
  const myClassesList = document.getElementById('my-classes-list');
  if (!myClassesList) return;
  
  const classes = getMyClasses();
  
  if (classes.length === 0) {
    myClassesList.innerHTML = `
      <p style="text-align: center; color: var(--text-muted); padding: 40px 0;">
        No classes added yet. Add your first class above!
      </p>
    `;
    return;
  }
  
  myClassesList.innerHTML = '';
  
  classes.forEach(classItem => {
    const classCard = document.createElement('div');
    classCard.className = 'update';
    classCard.style.cursor = 'pointer';
    
    classCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 18px; color: var(--text-main);">${classItem.course}</h3>
          ${classItem.professor ? `<p style="margin: 4px 0 0; font-size: 13px; color: var(--text-muted);">Prof. ${classItem.professor}</p>` : ''}
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary view-class-btn" data-course="${classItem.course}" data-professor="${classItem.professor || ''}">
            View Updates
          </button>
          <button class="btn btn-secondary remove-class-btn" data-course="${classItem.course}" data-professor="${classItem.professor || ''}" style="background: rgba(255, 0, 0, 0.1); color: #d32f2f;">
            Remove
          </button>
        </div>
      </div>
    `;
    
    myClassesList.appendChild(classCard);
  });
  
  // Add event listeners
  document.querySelectorAll('.view-class-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const course = this.dataset.course;
      const professor = this.dataset.professor;
      
      localStorage.setItem('catchup_university', 'university1');
      localStorage.setItem('catchup_course', course);
      localStorage.setItem('catchup_professor', professor || '');
      
      window.location.href = 'class.html';
    });
  });
  
  document.querySelectorAll('.remove-class-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const course = this.dataset.course;
      const professor = this.dataset.professor || null;
      
      if (confirm(`Remove ${course}${professor ? ` (Prof. ${professor})` : ''} from your classes?`)) {
        removeClass(course, professor);
        renderMyClasses();
      }
    });
  });
}

// ============================================
// LATEST UPDATES PAGE (latest.html)
// ============================================

function initLatestPage() {
  const feedElement = document.getElementById('latest-feed');
  if (!feedElement) return;
  
  const myClasses = getMyClasses();
  
  if (myClasses.length === 0) {
    feedElement.innerHTML = `
      <p style="text-align: center; color: var(--text-muted); padding: 40px 0;">
        No classes added yet. <a href="my-classes.html">Add classes</a> to see updates here!
      </p>
    `;
    return;
  }
  
  feedElement.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px 0;">Loading updates...</p>';
  
  loadLatestUpdates(myClasses);
}

function loadLatestUpdates(myClasses) {
  const feedElement = document.getElementById('latest-feed');
  const currentUserId = getUserId();
  
  // Get unique course codes
  const courseCodes = [...new Set(myClasses.map(c => c.course))];
  
  // Query for all updates from user's classes
  db.collection('updates')
    .where('course', 'in', courseCodes.slice(0, 10)) // Firebase limits 'in' queries to 10
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot((snapshot) => {
      feedElement.innerHTML = '';
      
      if (snapshot.empty) {
        feedElement.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px 0;">No updates yet for your classes!</p>';
        return;
      }
      
      snapshot.forEach((doc) => {
        const update = { id: doc.id, ...doc.data() };
        
        // Filter by professor if specified
        const classMatch = myClasses.find(c => {
          if (c.professor && update.professor) {
            return c.course === update.course && c.professor === update.professor;
          }
          return c.course === update.course;
        });
        
        if (classMatch) {
          const updateCard = createUpdateCard(update, currentUserId);
          feedElement.appendChild(updateCard);
        }
      });
      
      if (feedElement.children.length === 0) {
        feedElement.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px 0;">No updates yet for your classes!</p>';
      }
    }, (error) => {
      console.error('Error loading updates:', error);
      feedElement.innerHTML = '<p style="text-align: center; color: red; padding: 40px 0;">Error loading updates. Please refresh the page.</p>';
    });
}

// ============================================
// INITIALIZE APP
// ============================================

function initApp() {
  initIndexPage();
  initClassPage();
  initPostPage();
  initMyClassesPage();
  initLatestPage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}