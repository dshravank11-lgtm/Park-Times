let allArticles = [];
let activeCategory = 'All';
let editorPassword = null;
let editingPostId = null;
let imageLibrary = [];
let savedEditorRange = null;

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
    setupImageLibrary();
    setupPollEditor();
    loadImageLibrary();
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

function showComposeView(postToEdit) {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('composeView').classList.remove('hidden');

    if (postToEdit) {
       
        editingPostId = postToEdit.id;
        document.getElementById('composeTitle').textContent = 'Edit Story';
        document.getElementById('articleCategory').value = postToEdit.category || 'News';
        document.getElementById('articleTitle').value = postToEdit.title || '';
        setCoverImageValue(postToEdit.image || '');
        document.getElementById('articleSummary').value = postToEdit.summary || '';
        document.getElementById('articleContent').innerHTML = postToEdit.content || '';
        const btn = document.querySelector('#publishForm .btn-primary');
        if (btn) btn.textContent = 'Save Changes';
        document.getElementById('cancelEditBtn').classList.remove('hidden');
        loadExistingPoll(postToEdit.id);
    } else {
        resetComposeForm();
    }
}

function resetComposeForm() {
    editingPostId = null;
    document.getElementById('composeTitle').textContent = 'New Story';
    document.getElementById('publishForm').reset();
    setCoverImageValue('');
    resetPollEditor();
    document.getElementById('articleContent').innerHTML = '';
    document.getElementById('formStatus').textContent = '';
    const btn = document.querySelector('#publishForm .btn-primary');
    if (btn) btn.textContent = 'Publish Story';
    document.getElementById('cancelEditBtn').classList.add('hidden');
}

function handleCancelEdit() {
    resetComposeForm();
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

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn' + (editorPassword ? '' : ' hidden');
    editBtn.textContent = 'Edit';
    editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleEdit(article.id);
    };
    card.appendChild(editBtn);

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

function handleEdit(postId) {
    if (!editorPassword) return;
    const post = allArticles.find(a => a.id === postId);
    if (!post) return;

    const panel = document.getElementById('adminPanel');
    panel.classList.remove('hidden');
    showComposeView(post);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    const insertImageBtn = document.getElementById('insertImageBtn');
    insertImageBtn.addEventListener('mousedown', (e) => e.preventDefault());
    insertImageBtn.addEventListener('click', () => {
        openImageLibrary();
    });
}

function setupImageLibrary() {
    const select = document.getElementById('articleImageSelect');
    const input = document.getElementById('articleImage');
    const preview = document.getElementById('articleImagePreview');
    const insertBtn = document.getElementById('imageModalInsertBtn');
    const urlInput = document.getElementById('imageModalUrl');

    select.addEventListener('change', () => {
        if (select.value === '__custom__') {
            input.classList.remove('hidden');
            input.value = '';
            input.focus();
            syncCoverImagePreview();
        } else if (select.value) {
            input.classList.add('hidden');
            input.value = select.value;
            syncCoverImagePreview();
        } else {
            input.classList.add('hidden');
            input.value = '';
            syncCoverImagePreview();
        }
    });

    input.addEventListener('input', syncCoverImagePreview);

    urlInput.addEventListener('input', () => {
        document.querySelectorAll('.image-modal-thumb').forEach(t => t.classList.remove('selected'));
    });

    insertBtn.addEventListener('click', insertImageFromModal);
}

const MAX_POLL_OPTIONS = 6;
const MIN_POLL_OPTIONS = 2;

function setupPollEditor() {
    const optionsContainer = document.getElementById('pollOptions');
    const addBtn = document.getElementById('addPollOptionBtn');
    if (!optionsContainer || !addBtn) return;

    optionsContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.poll-option-remove');
        if (!removeBtn) return;
        if (optionsContainer.children.length <= MIN_POLL_OPTIONS) return;
        removeBtn.closest('.poll-option-row').remove();
    });

    addBtn.addEventListener('click', () => {
        if (optionsContainer.children.length >= MAX_POLL_OPTIONS) return;
        addPollOption('');
    });
}

function addPollOption(text) {
    const optionsContainer = document.getElementById('pollOptions');
    if (!optionsContainer || optionsContainer.children.length >= MAX_POLL_OPTIONS) return;

    const row = document.createElement('div');
    row.className = 'poll-option-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'poll-option-input';
    input.placeholder = `Option ${optionsContainer.children.length + 1}`;
    input.value = text || '';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'poll-option-remove';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '×';

    row.appendChild(input);
    row.appendChild(removeBtn);
    optionsContainer.appendChild(row);
}

function resetPollEditor() {
    const question = document.getElementById('pollQuestion');
    const optionsContainer = document.getElementById('pollOptions');
    const results = document.getElementById('pollEditorResults');
    if (!question || !optionsContainer) return;

    question.value = '';
    optionsContainer.innerHTML = '';
    addPollOption('');
    addPollOption('');
    if (results) {
        results.innerHTML = '';
        results.classList.add('hidden');
    }
}

function getPollOptions() {
    return Array.from(document.querySelectorAll('#pollOptions .poll-option-input'))
        .map(input => input.value.trim())
        .filter(text => text.length > 0);
}

function renderPollEditorResults(poll) {
    const results = document.getElementById('pollEditorResults');
    if (!results) return;

    results.innerHTML = '';
    poll.options.forEach(o => {
        const row = document.createElement('div');
        row.className = 'poll-editor-result';
        row.innerHTML = `<span>${escapeHtml(o.text)}</span><span>${o.votes} vote${o.votes === 1 ? '' : 's'}</span>`;
        results.appendChild(row);
    });

    const total = document.createElement('div');
    total.className = 'poll-editor-total';
    total.textContent = `${poll.totalVotes} total`;
    results.appendChild(total);

    results.classList.remove('hidden');
}

async function loadExistingPoll(postId) {
    resetPollEditor();
    if (!postId) return;

    try {
        const res = await fetch(`/api/polls?postId=${encodeURIComponent(postId)}`);
        const data = await res.json();
        if (data.poll) {
            document.getElementById('pollQuestion').value = data.poll.question;
            const optionsContainer = document.getElementById('pollOptions');
            optionsContainer.innerHTML = '';
            data.poll.options.forEach(o => addPollOption(o.text));
            renderPollEditorResults(data.poll);
        }
    } catch (err) {
        resetPollEditor();
    }
}

async function savePollForPost(postId) {
    const question = document.getElementById('pollQuestion').value.trim();
    const options = getPollOptions();

    try {
        await fetch('/api/polls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: editorPassword, postId, question, options })
        });
    } catch (err) {
        return;
    }
}

async function loadImageLibrary() {
    try {
        const res = await fetch('/api/images');
        const data = await res.json();
        imageLibrary = (data.images || []).map(name => ({ name, path: `images/${name}` }));
    } catch (err) {
        imageLibrary = [];
    }
    populateImageSelect();
    populateImageGrid();
}

function populateImageSelect() {
    const select = document.getElementById('articleImageSelect');
    if (!select) return;

    const current = document.getElementById('articleImage').value;
    const currentPath = current && !current.startsWith('http') ? current : '';

    const customOption = select.querySelector('option[value="__custom__"]');
    select.innerHTML = '';
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = '— No image —';
    select.appendChild(noneOption);

    imageLibrary.forEach(img => {
        const option = document.createElement('option');
        option.value = img.path;
        option.textContent = img.name;
        select.appendChild(option);
    });

    select.appendChild(customOption);

    setCoverImageValue(currentPath || current || '');
}

function setCoverImageValue(value) {
    const select = document.getElementById('articleImageSelect');
    const input = document.getElementById('articleImage');
    const preview = document.getElementById('articleImagePreview');

    if (!value) {
        select.value = '';
        input.value = '';
        input.classList.add('hidden');
    } else if (value.startsWith('images/') && imageLibrary.some(img => img.path === value)) {
        select.value = value;
        input.value = value;
        input.classList.add('hidden');
    } else {
        select.value = '__custom__';
        input.value = value;
        input.classList.remove('hidden');
    }

    syncCoverImagePreview();
}

function syncCoverImagePreview() {
    const preview = document.getElementById('articleImagePreview');
    const input = document.getElementById('articleImage');
    const img = preview.querySelector('img');
    const value = input.value.trim();

    if (value) {
        img.src = value;
        preview.classList.remove('hidden');
    } else {
        img.removeAttribute('src');
        preview.classList.add('hidden');
    }
}

function openImageLibrary() {
    saveEditorRange();
    populateImageGrid();
    document.getElementById('imageModalUrl').value = '';
    document.getElementById('imageModalCaption').value = '';
    document.getElementById('imageLibraryModal').classList.remove('hidden');
    document.querySelectorAll('.image-modal-thumb').forEach(t => t.classList.remove('selected'));
}

function saveEditorRange() {
    const editor = document.getElementById('articleContent');
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
        savedEditorRange = sel.getRangeAt(0).cloneRange();
    } else {
        savedEditorRange = null;
    }
}

function restoreEditorRange() {
    const editor = document.getElementById('articleContent');
    if (!savedEditorRange) {
        editor.focus();
        return;
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedEditorRange);
    editor.focus();
}

function closeImageLibrary() {
    document.getElementById('imageLibraryModal').classList.add('hidden');
}

function populateImageGrid() {
    const grid = document.getElementById('imageLibraryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (imageLibrary.length === 0) {
        grid.innerHTML = '<div class="image-modal-empty">No images in the images folder yet.</div>';
        return;
    }

    imageLibrary.forEach(img => {
        const thumb = document.createElement('div');
        thumb.className = 'image-modal-thumb';
        thumb.innerHTML = `<img src="${escapeAttr(img.path)}" alt="${escapeAttr(img.name)}" loading="lazy"><span>${escapeHtml(img.name)}</span>`;
        thumb.addEventListener('click', () => {
            document.querySelectorAll('.image-modal-thumb').forEach(t => t.classList.remove('selected'));
            thumb.classList.add('selected');
            document.getElementById('imageModalUrl').value = img.path;
        });
        grid.appendChild(thumb);
    });
}

function insertImageFromModal() {
    const editor = document.getElementById('articleContent');
    const url = document.getElementById('imageModalUrl').value.trim();
    const caption = document.getElementById('imageModalCaption').value.trim();

    if (!url) return;

    const figureHtml = caption
        ? `<figure><img src="${escapeAttr(url)}" alt=""><figcaption>${escapeHtml(caption)}</figcaption></figure><p><br></p>`
        : `<figure><img src="${escapeAttr(url)}" alt=""></figure><p><br></p>`;

    restoreEditorRange();
    insertHtmlAtCursor(editor, figureHtml);
    closeImageLibrary();
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

    if (!document.getElementById('publishRulesCheck').checked) {
        status.style.color = 'var(--red)';
        status.textContent = 'Please confirm you have read the rules.';
        return;
    }

    status.style.color = 'var(--text-muted)';
    status.textContent = editingPostId ? 'Saving...' : 'Publishing...';
    btn.textContent = editingPostId ? 'Saving...' : 'Publishing...';
    btn.disabled = true;

    const category = document.getElementById('articleCategory').value;
    const title = document.getElementById('articleTitle').value;
    const image = document.getElementById('articleImage').value;
    const summary = document.getElementById('articleSummary').value;
    const content = document.getElementById('articleContent').innerHTML;

    const isEditing = !!editingPostId;

    try {
        const response = await fetch('/api/posts', {
            method: isEditing ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: editorPassword,
                ...(isEditing ? { id: editingPostId } : {}),
                category, title, image, summary, content
            })
        });
        const result = await response.json();

        if (response.ok) {
            const postId = isEditing ? editingPostId : result.post.id;
            await savePollForPost(postId);

            status.style.color = '#2f7a3f';
            status.textContent = isEditing ? 'Saved!' : 'Published!';
            resetComposeForm();
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
            status.textContent = result.error || (isEditing ? 'Failed to save.' : 'Failed to publish.');
        }
    } catch (error) {
        status.style.color = 'var(--red)';
        status.textContent = 'Server connection error.';
    } finally {
        btn.textContent = isEditing ? 'Save Changes' : 'Publish Story';
        btn.disabled = false;
    }
}

function escapeHtml(str) {
    return str ? str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : '';
}

function escapeAttr(str) {
    return escapeHtml(str);
}
