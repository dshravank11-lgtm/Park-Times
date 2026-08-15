document.addEventListener('DOMContentLoaded', () => {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);
    document.getElementById('year').textContent = new Date().getFullYear();
    loadArticle();
});

function hideOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

async function loadArticle() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const main = document.getElementById('articleMain');

    if (!id) {
        renderNotFound(main);
        hideOverlay();
        return;
    }

    try {
        const res = await fetch('/api/posts');
        const data = await res.json();
        const posts = data.posts || [];
        const post = posts.find(p => p.id === id);

        if (!post) {
            renderNotFound(main);
        } else {
            renderArticle(main, post);
        }
    } catch (err) {
        main.innerHTML = '<div class="empty-state">Could not load this story. Check your connection and try again.</div>';
    } finally {
        hideOverlay();
    }
}

function renderNotFound(main) {
    main.innerHTML = `
        <div class="empty-state">
            Story not found.<br>
            <a href="index.html" class="back-link back-link--bottom">&larr; Back to Park Times</a>
        </div>
    `;
}

function renderArticle(main, post) {
    document.title = `${post.title} — Park Times`;

    const dateFormatted = new Date(post.date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    const heroImage = post.image
        ? `<div class="image-wrapper article-hero-image"><img src="${escapeAttr(post.image)}" alt=""></div>`
        : '';

    const body = post.content && post.content.trim()
        ? post.content
        : `<p>${escapeHtml(post.summary)}</p>`;

    main.innerHTML = `
        <span class="label">${escapeHtml(post.category)}</span>
        <h1 class="article-headline">${escapeHtml(post.title)}</h1>
        <div class="article-byline"><span>${dateFormatted}</span></div>
        ${heroImage}
        <div class="article-body">${body}</div>
        <a href="index.html" class="back-link back-link--bottom">&larr; Back to Park Times</a>
    `;
}

function escapeHtml(str) {
    return str ? str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : '';
}

function escapeAttr(str) {
    return escapeHtml(str);
}
