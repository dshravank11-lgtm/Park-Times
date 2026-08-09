let allArticles = [];
let activeCategory = 'All';
document.addEventListener('DOMContentLoaded', () => {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);
    document.getElementById('year').textContent = new Date().getFullYear();

    fetchNews();
});

function toggleAdminPanel() {
    const panel = document.getElementById('adminPanel');
    panel.classList.toggle('hidden');
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
        const card = document.createElement('article');

        let imgHTML = article.image ? `<img src="${escapeHtml(article.image)}" alt="Article Image">` : '';

        card.innerHTML = `
      <span class="label">${escapeHtml(article.category)}</span>
      ${imgHTML}
      <h3 class="story-headline">${escapeHtml(article.title)}</h3>
      <p class="story-summary">${escapeHtml(article.summary)}</p>
      <span class="story-date">${new Date(article.date).toLocaleDateString('en-US')}</span>
    `;
        grid.appendChild(card);
    });
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
