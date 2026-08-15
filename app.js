let allArticles = [];
let activeCategory = 'All';
let editorPassword = null;

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

document.addEventListener('DOMContentLoaded', () => {
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);
    document.getElementById('year').textContent = new Date().getFullYear();
    setupEditorToolbar();
    fetchNews();
});

function hideOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

function handleAdminButtonClick() {
    const panel = document.getElementById('adminPanel');
    const isHidden = panel.classList.contains('hidden');

    if (!isHidden) {
        closeAdminPanel();
        return;
    }

    panel.classList.remove('hidden');
    if (editorPassword) {
        showComposeView();
    } else {
        showLoginView();
    }
}

function closeAdminPanel() {
    document.getElementById('adminPanel').classList.add('hidden');
}

function showLoginView() {
    document.getElementById('loginView').classList.remove('hidden');
    document.getElementById('composeView').classList.add('hidden');
    const pwField = document.getElementById('loginPassword');
    pwField.value = '';
    document.getElementById('loginStatus').textContent = '';
    setTimeout(() => pwField.focus(), 50);
}

function showComposeView() {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('composeView').classList.remove('hidden');
}

async function handleLogin(event) {
    event.preventDefault();
    const status = document.getElementById('loginStatus');
    const btn = event.target.querySelector('.btn-primary');
    const password = document.getElementById('loginPassword').value;

    btn.textContent = 'Checking...';
    btn.disabled = true;
    status.style.color = 'var(--text-muted)';
    status.textContent = '';

    try {
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (res.ok) {
            editorPassword = password;
            document.getElementById('adminBtn').textContent = 'New Story';
            document.getElementById('signOutBtn').classList.remove('hidden');
            showComposeView();
            renderNews();
        } else {
            status.style.color = 'var(--red)';
            status.textContent = 'Incorrect password.';
        }
    } catch (err) {
        status.style.color = 'var(--red)';
        status.textContent = 'Connection error.';
    } finally {
        btn.textContent = 'Sign In';
        btn.disabled = false;
    }
}

function handleSignOut() {
    editorPassword = null;
    document.getElementById('adminBtn').textContent = 'Editor Sign In';
    document.getElementById('signOutBtn').classList.add('hidden');
    closeAdminPanel();
    renderNews();
}

function showSkeletons() {
    const heroSlot = document.getElementById('heroSlot');
    const grid = document.getElementById('newsGrid');
    heroSlot.innerHTML = '<div class="skeleton-card skeleton-card--hero"><div class="skeleton-line short" style="margin-bottom:12px"></div><div class="skeleton-line tall"></div><div class="skeleton-line full"></div><div class="skeleton-line medium"></div></div>';
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
        document.getElementById('heroSlot').innerHTML = '';
        document.getElementById('newsGrid').innerHTML = '<div class="empty-state">Error loading news articles.</div>';
    } finally {
        hideOverlay();
    }
}

function filterCategory(category, element) {
    if (category === activeCategory) return;
    activeCategory = category;
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    element.classList.add('active');

    const heroSlot = document.getElementById('heroSlot');
    const grid = document.getElementById('newsGrid');
    heroSlot.classList.add('fading');
    grid.classList.add('fading');

    setTimeout(() => {
        renderNews();
        heroSlot.classList.remove('fading');
        grid.classList.remove('fading');
    }, 180);
}

function renderNews() {
    const heroSlot = document.getElementById('heroSlot');
    const grid = document.getElementById('newsGrid');
    heroSlot.innerHTML = '';
    grid.innerHTML = '';

    const filtered = activeCategory === 'All'
        ? allArticles
        : allArticles.filter(a => a.category.toLowerCase() === activeCategory.toLowerCase());

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state">No stories published yet.</div>';
        return;
    }

    const [first, ...rest] = filtered;

    const heroCard = buildCard(first, true);
    heroSlot.appendChild(heroCard);
    revealObserver.observe(heroCard);

    rest.forEach((article, index) => {
        const card = buildCard(article, false);
        card.style.animationDelay = `${Math.min(index, 8) * 60}ms`;
        grid.appendChild(card);
        revealObserver.observe(card);
    });
}

function buildCard(article, isHero) {
    const card = document.createElement('article');
    card.className = 'article-card' + (isHero ? ' article-card--hero' : '');
    card.dataset.id = article.id;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn' + (editorPassword ? '' : ' hidden');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleDelete(article.id);
    };
    card.appendChild(deleteBtn);

    const link = document.createElement('a');
    link.className = 'card-link';
    link.href = `article.html?id=${encodeURIComponent(article.id)}`;

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = article.category;
    link.appendChild(label);

    if (article.image) {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';
        const img = document.createElement('img');
        img.src = article.image;
        img.alt = '';
        img.loading = 'lazy';
        wrapper.appendChild(img);
        link.appendChild(wrapper);
    }

    const headline = document.createElement('h3');
    headline.className = 'story-headline';
    headline.textContent = article.title;
    link.appendChild(headline);

    const summary = document.createElement('p');
    summary.className = 'story-summary';
    summary.textContent = article.summary;
    link.appendChild(summary);

    const meta = document.createElement('div');
    meta.className = 'story-meta';
    const date = document.createElement('span');
    date.className = 'story-date';
    date.textContent = new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    meta.appendChild(date);
    link.appendChild(meta);

    card.appendChild(link);
    return card;
}

async function handleDelete(postId) {
    if (!editorPassword) {
        alert('Please sign in as an editor first.');
        return;
    }

    if (!confirm('Delete this story? This cannot be undone.')) return;

    try {
        const res = await fetch('/api/posts', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: editorPassword, id: postId })
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
        } else if (res.status === 401) {
            alert('Your session is no longer valid. Please sign in again.');
            handleSignOut();
        } else {
            alert(result.error || 'Failed to delete.');
        }
    } catch (err) {
        alert('Server connection error.');
    }
}

function setupEditorToolbar() {
    const toolbar = document.querySelector('.editor-toolbar');
    const editor = document.getElementById('articleContent');
    if (!toolbar || !editor) return;

    toolbar.querySelectorAll('.editor-btn[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => {
            editor.focus();
            const cmd = btn.dataset.cmd;
            if (cmd === 'bold') document.execCommand('bold');
            else if (cmd === 'italic') document.execCommand('italic');
            else if (cmd === 'h2') document.execCommand('formatBlock', false, 'h2');
            else if (cmd === 'quote') document.execCommand('formatBlock', false, 'blockquote');
        });
    });

    document.getElementById('insertImageBtn').addEventListener('click', () => {
        const url = prompt('Image URL (e.g. image2.png or https://example.com/photo.jpg):');
        if (!url) return;
        const caption = prompt('Caption (optional, leave blank to skip):') || '';

        const figureHtml = caption
            ? `<figure><img src="${escapeAttr(url)}" alt=""><figcaption>${escapeHtml(caption)}</figcaption></figure><p><br></p>`
            : `<figure><img src="${escapeAttr(url)}" alt=""></figure><p><br></p>`;

        insertHtmlAtCursor(editor, figureHtml);
    });
}

function insertHtmlAtCursor(editor, html) {
    editor.focus();
    const sel = window.getSelection();

    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) {
        editor.insertAdjacentHTML('beforeend', html);
        return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();
    const frag = range.createContextualFragment(html);
    const lastNode = frag.lastChild;
    range.insertNode(frag);

    if (lastNode) {
        const newRange = document.createRange();
        newRange.setStartAfter(lastNode);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }
}

async function handlePublish(event) {
    event.preventDefault();

    if (!editorPassword) {
        alert('Please sign in as an editor first.');
        return;
    }

    const status = document.getElementById('formStatus');
    const btn = event.target.querySelector('.btn-primary');

    status.style.color = 'var(--text-muted)';
    status.textContent = 'Publishing...';
    btn.textContent = 'Publishing...';
    btn.disabled = true;

    const category = document.getElementById('articleCategory').value;
    const title = document.getElementById('articleTitle').value;
    const image = document.getElementById('articleImage').value;
    const summary = document.getElementById('articleSummary').value;
    const content = document.getElementById('articleContent').innerHTML;

    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: editorPassword, category, title, image, summary, content })
        });
        const result = await response.json();

        if (response.ok) {
            status.style.color = '#2f7a3f';
            status.textContent = 'Published!';
            document.getElementById('publishForm').reset();
            document.getElementById('articleContent').innerHTML = '';
            setTimeout(() => {
                closeAdminPanel();
                fetchNews();
            }, 600);
        } else if (response.status === 401) {
            status.style.color = 'var(--red)';
            status.textContent = 'Your session is no longer valid.';
            handleSignOut();
        } else {
            status.style.color = 'var(--red)';
            status.textContent = result.error || 'Failed to publish.';
        }
    } catch (error) {
        status.style.color = 'var(--red)';
        status.textContent = 'Server connection error.';
    } finally {
        btn.textContent = 'Publish Story';
        btn.disabled = false;
    }
}

function escapeHtml(str) {
    return str ? str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : '';
}

function escapeAttr(str) {
    return escapeHtml(str);
}
