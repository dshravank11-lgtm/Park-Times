let allArticles = [];
let activeCategory = 'All';
let adminOpen = false;
let adminPassword = '';

document.addEventListener('DOMContentLoaded', () => {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);
    document.getElementById('year').textContent = new Date().getFullYear();

    fetchNews();
});



function toggleAdminPanel() {
    const panel = document.getElementById('adminPanel');
    adminOpen = !adminOpen;
    panel.classList.toggle('hidden', !adminOpen);


    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.classList.toggle('hidden', !adminOpen);
    });
}



async function fetchNews() {
    const grid = document.getElementById('newsGrid');
    grid.innerHTML = '<div class="empty-state">Loading stories...</div>';

    try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        allArticles = data.posts || [];
        renderNews();
    } catch (err) {
        grid.innerHTML = '<div class="empty-state">Error loading news articles.</div>';
    }
}

function filterCategory(category, element) {
    activeCategory = category;
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    element.classList.add('active');
    renderNews();
}

function renderNews() {
    const grid = document.getElementById('newsGrid');
    grid.innerHTML = '';

    const filtered = activeCategory === 'All'
        ? allArticles
        : allArticles.filter(a => a.category.toLowerCase() === activeCategory.toLowerCase());

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state">No stories published yet.</div>';
        return;
    }

    filtered.forEach(article => {
        const card = buildCard(article);
        grid.appendChild(card);
        loadComments(article.id);
    });
}

function buildCard(article) {
    const card = document.createElement('article');
    card.dataset.id = article.id;


    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn' + (adminOpen ? '' : ' hidden');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => handleDelete(article.id);
    card.appendChild(deleteBtn);


    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = article.category;
    card.appendChild(label);


    if (article.image) {
        const img = document.createElement('img');
        img.src = article.image;
        img.alt = 'Article Image';
        card.appendChild(img);
    }


    const headline = document.createElement('h3');
    headline.className = 'story-headline';
    headline.textContent = article.title;
    card.appendChild(headline);


    const summary = document.createElement('p');
    summary.className = 'story-summary';
    summary.textContent = article.summary;
    card.appendChild(summary);


    const date = document.createElement('span');
    date.className = 'story-date';
    date.textContent = new Date(article.date).toLocaleDateString('en-US');
    card.appendChild(date);


    card.appendChild(buildCommentSection(article.id));

    return card;
}



async function handleDelete(postId) {
    if (!confirm('Delete this story? This cannot be undone.')) return;

    const pw = document.getElementById('adminPassword').value;
    if (!pw) {
        alert('Enter your editor password in the panel above first.');
        return;
    }

    try {
        const res = await fetch('/api/posts', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw, id: postId })
        });
        const result = await res.json();

        if (res.ok) {

            allArticles = allArticles.filter(a => a.id !== postId);
            renderNews();
        } else {
            alert(result.error || 'Failed to delete.');
        }
    } catch (err) {
        alert('Server connection error.');
    }
}



function buildCommentSection(postId) {
    const section = document.createElement('div');
    section.className = 'comment-section';
    section.id = `comments-${postId}`;


    const toggle = document.createElement('button');
    toggle.className = 'comments-toggle';
    toggle.textContent = 'Comments';
    toggle.onclick = () => {
        const body = section.querySelector('.comments-body');
        const isOpen = !body.classList.contains('hidden');
        body.classList.toggle('hidden', isOpen);
        toggle.textContent = isOpen ? 'Comments' : 'Hide Comments';
    };
    section.appendChild(toggle);

    const body = document.createElement('div');
    body.className = 'comments-body hidden';

    const list = document.createElement('div');
    list.className = 'comments-list';
    list.id = `comments-list-${postId}`;
    body.appendChild(list);


    body.appendChild(buildCommentForm(postId));
    section.appendChild(body);

    return section;
}

function buildCommentForm(postId) {
    const form = document.createElement('form');
    form.className = 'comment-form';
    form.onsubmit = (e) => handleComment(e, postId);


    const nameRow = document.createElement('div');
    nameRow.className = 'comment-name-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'comment-name-input';
    nameInput.placeholder = 'Your name';
    nameInput.maxLength = 50;
    nameInput.required = true;
    nameInput.value = localStorage.getItem('commenterName') || '';
    nameInput.addEventListener('change', () => {
        localStorage.setItem('commenterName', nameInput.value.trim());
    });
    nameRow.appendChild(nameInput);
    form.appendChild(nameRow);


    const textInput = document.createElement('textarea');
    textInput.className = 'comment-text-input';
    textInput.placeholder = 'Write a comment...';
    textInput.maxLength = 500;
    textInput.rows = 2;
    textInput.required = true;
    form.appendChild(textInput);


    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'comment-submit';
    submit.textContent = 'Post';
    form.appendChild(submit);

    const status = document.createElement('p');
    status.className = 'comment-status';
    form.appendChild(status);

    return form;
}

async function loadComments(postId) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;

    try {
        const res = await fetch(`/api/comments?postId=${postId}`);
        const data = await res.json();
        renderComments(postId, data.comments || []);
    } catch (err) {

    }
}

function renderComments(postId, comments) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;
    list.innerHTML = '';

    if (comments.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'comments-empty';
        empty.textContent = 'No comments yet. Be the first!';
        list.appendChild(empty);
        return;
    }

    comments.forEach(c => {
        const item = document.createElement('div');
        item.className = 'comment-item';

        const meta = document.createElement('div');
        meta.className = 'comment-meta';

        const name = document.createElement('span');
        name.className = 'comment-author';
        name.textContent = c.name;

        const date = document.createElement('span');
        date.className = 'comment-date';
        date.textContent = new Date(c.date).toLocaleDateString('en-US');

        meta.appendChild(name);
        meta.appendChild(date);

        const text = document.createElement('p');
        text.className = 'comment-text';
        text.textContent = c.text;

        item.appendChild(meta);
        item.appendChild(text);
        list.appendChild(item);
    });
}

async function handleComment(event, postId) {
    event.preventDefault();
    const form = event.target;
    const nameInput = form.querySelector('.comment-name-input');
    const textInput = form.querySelector('.comment-text-input');
    const status = form.querySelector('.comment-status');

    const name = nameInput.value.trim();
    const text = textInput.value.trim();

    if (!name || !text) return;


    localStorage.setItem('commenterName', name);

    status.style.color = '#666';
    status.textContent = 'Posting...';

    try {
        const res = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, name, text })
        });
        const result = await res.json();

        if (res.ok) {
            textInput.value = '';
            status.textContent = '';
            await loadComments(postId);
        } else {
            status.style.color = 'red';
            status.textContent = result.error || 'Failed to post comment.';
        }
    } catch (err) {
        status.style.color = 'red';
        status.textContent = 'Server connection error.';
    }
}



async function handlePublish(event) {
    event.preventDefault();

    const status = document.getElementById('formStatus');
    status.style.color = '#000';
    status.textContent = 'Verifying password and publishing...';

    const password = document.getElementById('adminPassword').value;
    const category = document.getElementById('articleCategory').value;
    const title = document.getElementById('articleTitle').value;
    const image = document.getElementById('articleImage').value;
    const summary = document.getElementById('articleSummary').value;

    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, category, title, image, summary })
        });

        const result = await response.json();

        if (response.ok) {
            status.style.color = 'green';
            status.textContent = 'Published successfully!';
            document.getElementById('publishForm').reset();
            toggleAdminPanel();
            fetchNews();
        } else {
            status.style.color = 'red';
            status.textContent = result.error || 'Authentication failed.';
        }
    } catch (error) {
        status.style.color = 'red';
        status.textContent = 'Server connection error.';
    }
}



function escapeHtml(str) {
    return str ? str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : '';
}
