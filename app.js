let allArticles = [];
let activeCategory = 'All';
let adminOpen = false;

document.addEventListener('DOMContentLoaded', () => {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);
    document.getElementById('year').textContent = new Date().getFullYear();
    fetchNews();
});

function hideOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

function toggleAdminPanel() {
    const panel = document.getElementById('adminPanel');
    adminOpen = !adminOpen;
    panel.classList.toggle('hidden', !adminOpen);
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.classList.toggle('hidden', !adminOpen);
    });
}

function showSkeletons() {
    const grid = document.getElementById('newsGrid');
    grid.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const sk = document.createElement('div');
        sk.className = 'skeleton-card';
        sk.innerHTML = `
            <div class="skeleton-line short" style="margin-bottom:12px"></div>
            <div class="skeleton-line tall"></div>
            <div class="skeleton-line full"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line short" style="margin-top:14px"></div>
        `;
        grid.appendChild(sk);
    }
}

async function fetchNews() {
    showSkeletons();
    try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        allArticles = data.posts || [];
        renderNews();
    } catch (err) {
        const grid = document.getElementById('newsGrid');
        grid.innerHTML = '<div class="empty-state">Error loading news articles.</div>';
    } finally {
        hideOverlay();
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

    filtered.forEach((article, index) => {
        const card = buildCard(article);
        card.style.animationDelay = `${index * 60}ms`;
        grid.appendChild(card);
        loadComments(article.id);
    });

    requestAnimationFrame(() => {
        document.querySelectorAll('.article-card').forEach(card => {
            card.classList.add('visible');
        });
    });
}

function buildCard(article) {
    const card = document.createElement('article');
    card.className = 'article-card';
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
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';
        const img = document.createElement('img');
        img.src = article.image;
        img.alt = '';
        img.loading = 'lazy';
        wrapper.appendChild(img);
        card.appendChild(wrapper);
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
    date.textContent = new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
            const card = document.querySelector(`article[data-id="${postId}"]`);
            if (card) {
                card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.97)';
                setTimeout(() => {
                    allArticles = allArticles.filter(a => a.id !== postId);
                    renderNews();
                }, 310);
            }
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
        toggle.classList.toggle('open', !isOpen);
        toggle.textContent = isOpen ? 'Comments' : 'Comments';
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
    form.appendChild(nameInput);

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
    } catch (err) {}
}

function renderComments(postId, comments) {
    const list = document.getElementById(`comments-list-${postId}`);
    if (!list) return;
    list.innerHTML = '';

    const toggle = document.querySelector(`#comments-${postId} .comments-toggle`);

    if (comments.length > 0 && toggle) {
        toggle.textContent = `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`;
    }

    if (comments.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'comments-empty';
        empty.textContent = 'No comments yet. Be the first!';
        list.appendChild(empty);
        return;
    }

    comments.forEach((c, i) => {
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.style.animationDelay = `${i * 40}ms`;

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
    const submit = form.querySelector('.comment-submit');

    const name = nameInput.value.trim();
    const text = textInput.value.trim();
    if (!name || !text) return;

    localStorage.setItem('commenterName', name);

    submit.textContent = '...';
    submit.disabled = true;
    status.style.color = '#999';
    status.textContent = '';

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
            status.textContent = result.error || 'Failed to post.';
        }
    } catch (err) {
        status.style.color = 'red';
        status.textContent = 'Connection error.';
    } finally {
        submit.textContent = 'Post';
        submit.disabled = false;
    }
}

async function handlePublish(event) {
    event.preventDefault();
    const status = document.getElementById('formStatus');
    const btn = event.target.querySelector('.btn-primary');

    status.style.color = '#666';
    status.textContent = 'Publishing...';
    btn.textContent = 'Publishing...';
    btn.disabled = true;

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
            status.textContent = 'Published!';
            document.getElementById('publishForm').reset();
            setTimeout(() => {
                toggleAdminPanel();
                fetchNews();
            }, 600);
        } else {
            status.style.color = 'red';
            status.textContent = result.error || 'Authentication failed.';
        }
    } catch (error) {
        status.style.color = 'red';
        status.textContent = 'Server connection error.';
    } finally {
        btn.textContent = 'Publish Story';
        btn.disabled = false;
    }
}

function escapeHtml(str) {
    return str ? str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : '';
}
